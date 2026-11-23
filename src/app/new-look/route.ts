import { NextResponse, type NextRequest } from "next/server";
import { HOUSE_COOKIE, HOUSE_VALUE } from "@/lib/house";

/**
 * Preview switch for the one-screen "house" member app. /new-look turns it on for this browser,
 * /new-look?off=1 turns it off again. Members who never open the link keep the current look.
 */
export function GET(req: NextRequest) {
  const off = req.nextUrl.searchParams.has("off");
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (off) res.cookies.delete(HOUSE_COOKIE);
  else res.cookies.set(HOUSE_COOKIE, HOUSE_VALUE, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}
