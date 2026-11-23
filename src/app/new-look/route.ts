import { NextResponse, type NextRequest } from "next/server";
import { CLASSIC_VALUE, HOUSE_COOKIE } from "@/lib/house";

/**
 * Fallback switch: /new-look?off=1 brings back the classic sidebar look for this browser,
 * /new-look returns to the house look (the default for everyone).
 */
export function GET(req: NextRequest) {
  const off = req.nextUrl.searchParams.has("off");
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (off) res.cookies.set(HOUSE_COOKIE, CLASSIC_VALUE, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  else res.cookies.delete(HOUSE_COOKIE);
  return res;
}
