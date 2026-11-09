"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit, currentAdminBase } from "@/lib/auth/guards";
import { NOT_SWITCHED_ON, type FormState } from "@/lib/auth/form-state";
import { clientIp, isLockedOut, LOCKOUT, normalizeUsername, PASSWORD_MIN, USERNAME_RE } from "@/lib/auth/policy";
import { adminHref } from "@/lib/hosts";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const GENERIC = "That username and password don't match.";
const to = async (p: string) => adminHref(p, await currentAdminBase());

async function isListedAdmin(userId: string) {
  const { data } = await createServiceClient().from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

/** Step 1: username and password. Then on to the 2-step code. */
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
  const { data: admin } = await svc.from("admin_users").select("user_id").eq("username", username).maybeSingle();
  const email = admin ? (await svc.auth.admin.getUserById(admin.user_id)).data.user?.email : null;
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
  redirect(await to("/admin/verify"));
}

/** Step 2: the 6-digit code from the authenticator app (also finishes first-time setup). */
export async function adminVerify(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const factorId = String(form.get("factorId") ?? "");
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId || !(await isListedAdmin(userId))) redirect(await to("/admin/sign-in"));

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: "That code didn't work. Codes change every 30 seconds; try the current one." };

  await audit(userId, "admin.sign_in", "admin_session");
  redirect(await to("/admin"));
}

/** First visit from the invite email: set a password, then set up the authenticator app. */
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
    return { error: "We couldn't save the password. Open the invite link again or ask for a new invite." };
  }
  await audit(userId, "admin.password_set", "admin_users", { entityId: userId });
  redirect(await to("/admin/verify"));
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
