import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SURFACE_HEADER } from "@/lib/hosts";
import { allowedOtpType, safeNext } from "@/lib/auth/policy";
import { createClient } from "@/lib/supabase/server";

/**
 * Links from emails land here: confirm a new member's email, reset a password,
 * or (on the admin host only) accept an admin invite.
 * Accepts both link styles: our custom templates (token_hash + type) and
 * Supabase's default templates, which arrive with a one-time `code`.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const surface = req.headers.get(SURFACE_HEADER);
  const fail = NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  if (code) {
    // Code links come from member sign-up and password reset only.
    if (surface === "admin") return fail;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail;
    return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next"), "/welcome"), url.origin));
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!tokenHash || !allowedOtpType(surface, type)) return fail;

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
  if (error) return fail;

  const next = surface === "admin" ? "/set-password" : safeNext(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/welcome");
  return NextResponse.redirect(new URL(next, url.origin));
}
