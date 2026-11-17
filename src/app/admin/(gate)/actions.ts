"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit, currentAdminBase } from "@/lib/auth/guards";
import { NOT_SWITCHED_ON, type FormState } from "@/lib/auth/form-state";
import { ADMIN_RESET, clientIp, isLockedOut, LOCKOUT, normalizeUsername, PASSWORD_MIN, resetAllowed, USERNAME_RE } from "@/lib/auth/policy";
import { sendAdminPasswordChanged, sendAdminPasswordReset, sendAdminSignInAlert } from "@/lib/email/admin";
import { adminHref } from "@/lib/hosts";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const GENERIC = "That username and password don't match.";
const ADMIN_ORIGIN = `https://${process.env.ADMIN_HOST ?? "admin.ventureweavers.com"}`;
const RESET_SENT = "If that username belongs to an active admin account, we've emailed its owner a link to choose a new password. It expires in 2 hours.";
const to = async (p: string) => adminHref(p, await currentAdminBase());

async function isListedAdmin(userId: string) {
  const { data } = await createServiceClient().from("admin_users").select("user_id, paused_at").eq("user_id", userId).maybeSingle();
  return Boolean(data && !data.paused_at);
}

/** Admin sign-in: username and password (2-step removed in Phase 10). Emails the admin a sign-in alert. */
export async function adminSignIn(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const ip = clientIp(await headers());
  const svc = createServiceClient();

  const since = new Date(Date.now() - LOCKOUT.windowMinutes * 60_000).toISOString();
  const failures = (col: "username" | "ip", v: string | null) =>
    v
      ? svc.from("auth_attempts").select("id", { count: "exact", head: true }).eq("scope", "admin").eq("ok", false).eq(col, v).gte("at", since)
      : Promise.resolve({ count: 0 });
  const [byUser, byIp] = await Promise.all([failures("username", username || null), failures("ip", ip)]);
  if (isLockedOut({ byUsername: byUser.count ?? 0, byIp: byIp.count ?? 0 })) {
    return { error: `Too many attempts. Try again in ${LOCKOUT.windowMinutes} minutes.` };
  }
  const record = (ok: boolean) => svc.from("auth_attempts").insert({ scope: "admin", username: username || null, ip, ok });

  if (!USERNAME_RE.test(username) || !password) {
    await record(false);
    return { error: GENERIC };
  }
  const { data: admin } = await svc.from("admin_users").select("user_id, paused_at").eq("username", username).maybeSingle();
  // Paused team members get the same message as a wrong password.
  const email = admin && !admin.paused_at ? (await svc.auth.admin.getUserById(admin.user_id)).data.user?.email : null;
  if (!email) {
    await record(false);
    return { error: GENERIC };
  }

  const supabase = await createClient();
  const captchaToken = (form.get("cf-turnstile-response") as string | null) || undefined;
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
  if (error) {
    await record(false);
    return { error: GENERIC };
  }
  await record(true);
  const { data: signedIn } = await supabase.auth.getClaims();
  const userId = signedIn?.claims?.sub;
  if (userId) {
    await audit(userId, "admin.sign_in", "admin_session");
    await sendAdminSignInAlert(email, { username, ip, userAgent: (await headers()).get("user-agent") }).catch(() => {});
  }
  redirect(await to("/admin"));
}

/**
 * "Forgot password" on the admin sign-in page. Asks for the username only and emails a one-time link
 * to that admin's own address. The answer is the same whether or not the username exists.
 * Limits: 3 emails per account and 5 requests per IP an hour (counted in the audit log).
 */
export async function adminForgotPassword(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const username = normalizeUsername(String(form.get("username") ?? ""));
  if (!USERNAME_RE.test(username)) return { error: "Type your admin username, for example ahmed.fouad." };
  const ip = clientIp(await headers());
  const svc = createServiceClient();
  const since = new Date(Date.now() - ADMIN_RESET.windowMinutes * 60_000).toISOString();

  const { data: admin } = await svc.from("admin_users").select("user_id, paused_at").eq("username", username).maybeSingle();
  const [byIp, byAccount] = await Promise.all([
    ip ? svc.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "admin.password_reset_request").eq("ip", ip).gte("at", since) : Promise.resolve({ count: 0 }),
    admin ? svc.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "admin.password_reset_sent").eq("entity_id", admin.user_id).gte("at", since) : Promise.resolve({ count: 0 }),
  ]);
  if (!resetAllowed({ byAccount: byAccount.count ?? 0, byIp: byIp.count ?? 0 })) {
    return { error: "Too many reset requests. Try again in an hour." };
  }
  // Every request is counted against the IP address, whether or not the username exists.
  await svc.from("audit_log").insert({ actor: admin?.user_id ?? null, action: "admin.password_reset_request", entity: "admin_users", entity_id: admin?.user_id ?? null, ip });
  if (!admin || admin.paused_at) return { message: RESET_SENT };

  const email = (await svc.auth.admin.getUserById(admin.user_id)).data.user?.email;
  if (!email || !process.env.RESEND_API_KEY) return { message: RESET_SENT };
  const { data: link, error } = await svc.auth.admin.generateLink({ type: "recovery", email });
  const token = link?.properties?.hashed_token;
  if (error || !token) return { error: "Couldn't create a reset link. Try again in a minute." };
  try {
    await sendAdminPasswordReset(email, { username, href: `${ADMIN_ORIGIN}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery`, ip });
  } catch {
    return { error: "The email service didn't accept the message. Try again in a minute." };
  }
  await svc.from("audit_log").insert({ actor: admin.user_id, action: "admin.password_reset_sent", entity: "admin_users", entity_id: admin.user_id, ip });
  return { message: RESET_SENT };
}

/** From the invite email (first password) or the reset email: set a password, then straight into the console. */
export async function adminSetPassword(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const password = String(form.get("password") ?? "");
  if (password.length < PASSWORD_MIN.admin) return { error: `Use at least ${PASSWORD_MIN.admin} characters.` };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId || !(await isListedAdmin(userId))) redirect(await to("/admin/sign-in"));

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too common or has appeared in a data leak. Please choose another." };
    if (error.code === "same_password") return { error: "That's your current password. Choose a new one." };
    return { error: "We couldn't save the password. Open the link from your email again, or ask for a new one from Forgot password." };
  }
  await audit(userId, "admin.password_set", "admin_users", { entityId: userId });
  // Sign out every other device, and tell the admin their password changed.
  await supabase.auth.signOut({ scope: "others" }).catch(() => {});
  const svc = createServiceClient();
  const [{ data: row }, { data: u }] = await Promise.all([svc.from("admin_users").select("username").eq("user_id", userId).maybeSingle(), svc.auth.admin.getUserById(userId)]);
  if (u?.user?.email && row?.username) await sendAdminPasswordChanged(u.user.email, { username: row.username, ip: clientIp(await headers()) }).catch(() => {});
  redirect(await to("/admin"));
}

export async function adminSignOut() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const sessionId = data?.claims?.session_id;
    if (sessionId) {
      await createServiceClient().from("admin_sessions").update({ revoked_at: new Date().toISOString() }).eq("session_id", sessionId);
    }
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect(await to("/admin/sign-in"));
}
