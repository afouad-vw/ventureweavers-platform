import { NextResponse, type NextRequest } from "next/server";
import { SURFACE_HEADER } from "@/lib/hosts";
import { safeNext } from "@/lib/auth/policy";
import { createClient } from "@/lib/supabase/server";

/** Google and LinkedIn send members back here. Never used on the admin host. */
export async function GET(req: NextRequest) {
  if (req.headers.get(SURFACE_HEADER) === "admin") return new NextResponse(null, { status: 404 });
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    const banned = error?.code === "user_banned" || /banned/i.test(error?.message ?? "");
    return NextResponse.redirect(new URL(`/sign-in?error=${banned ? "suspended" : "link"}`, url.origin));
  }

  const { data: p } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
  return NextResponse.redirect(new URL(p?.onboarded_at ? next : `/welcome?next=${encodeURIComponent(next)}`, url.origin));
}
