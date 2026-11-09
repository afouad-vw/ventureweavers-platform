import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SURFACE_HEADER } from "@/lib/hosts";
import { allowedOtpType, safeNext } from "@/lib/auth/policy";
import { createClient } from "@/lib/supabase/server";

/**
 * Links from emails land here: confirm a new member's email, reset a password,
 * or (on the admin host only) accept an admin invite.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const surface = req.headers.get(SURFACE_HEADER);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const fail = surface === "admin" ? "/sign-in?error=link" : "/sign-in?error=link";

  if (!tokenHash || !allowedOtpType(surface, type)) return NextResponse.redirect(new URL(fail, url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
  if (error) return NextResponse.redirect(new URL(fail, url.origin));

  const next = surface === "admin" ? "/set-password" : safeNext(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/welcome");
  return NextResponse.redirect(new URL(next, url.origin));
}
