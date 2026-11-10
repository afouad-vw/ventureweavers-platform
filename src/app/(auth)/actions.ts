"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { requestOrigin } from "@/lib/origin";
import { NOT_SWITCHED_ON, type FormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN, safeNext } from "@/lib/auth/policy";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const captcha = (f: FormData) => (f.get("cf-turnstile-response") as string | null) || undefined;

/** Google or LinkedIn. */
export async function signInWithProvider(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const provider = str(form, "provider");
  if (provider !== "google" && provider !== "linkedin_oidc") return { error: "Unknown sign-in option." };
  const next = safeNext(str(form, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return { error: "We couldn't reach the sign-in service. Please try again." };
  redirect(data.url);
}

export async function signInWithEmail(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, "email"),
    password: String(form.get("password") ?? ""),
    options: { captchaToken: captcha(form) },
  });
  if (error) {
    if (error.code === "user_banned") return { error: "This account is suspended. If you think this is a mistake, email us at info@ventureweavers.com." };
    if (error.code === "email_not_confirmed") return { error: "Please confirm your email first. Check your inbox for the link." };
    return { error: "That email and password don't match." };
  }
  redirect(safeNext(str(form, "next")));
}

export async function signUpWithEmail(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const password = String(form.get("password") ?? "");
  if (password.length < PASSWORD_MIN.member) return { error: `Use at least ${PASSWORD_MIN.member} characters for your password.` };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: str(form, "email"),
    password,
    options: {
      data: { full_name: str(form, "name").slice(0, 120) },
      emailRedirectTo: `${await requestOrigin()}/auth/confirm?next=/welcome`,
      captchaToken: captcha(form),
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too common or has appeared in a data leak. Please choose another." };
    if (error.code === "over_email_send_rate_limit") return { error: "Too many attempts. Please wait a few minutes." };
    return { error: "We couldn't create your account. Please check your details and try again." };
  }
  // Same message whether or not the email already has an account, so accounts can't be discovered this way.
  return { message: "Check your email for a link to confirm your account." };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(str(form, "email"), {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/reset-password`,
    captchaToken: captcha(form),
  });
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_SWITCHED_ON };
  const password = String(form.get("password") ?? "");
  if (password.length < PASSWORD_MIN.member) return { error: `Use at least ${PASSWORD_MIN.member} characters.` };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too common or has appeared in a data leak. Please choose another." };
    return { error: "Your reset link has expired. Please request a new one." };
  }
  redirect("/my-space");
}

export async function signOut() {
  if (supabaseConfigured) await (await createClient()).auth.signOut({ scope: "local" });
  redirect("/");
}
