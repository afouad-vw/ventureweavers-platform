import { NextResponse, type NextRequest } from "next/server";
import { decide, hostConfig, SURFACE_HEADER } from "@/lib/hosts";

const NOT_FOUND = "/__not-found";

export function middleware(req: NextRequest) {
  const d = decide(req.headers.get("host"), req.nextUrl.pathname, hostConfig());

  if (d.kind === "redirect") return NextResponse.redirect(new URL(d.url + req.nextUrl.search), 308);

  // Never trust a surface header sent by the browser.
  const headers = new Headers(req.headers);
  headers.delete(SURFACE_HEADER);

  if (d.kind === "notfound") {
    return NextResponse.rewrite(new URL(NOT_FOUND, req.url), { request: { headers } });
  }

  headers.set(SURFACE_HEADER, d.surface);
  const res =
    d.kind === "rewrite"
      ? NextResponse.rewrite(new URL(d.path + req.nextUrl.search, req.url), { request: { headers } })
      : NextResponse.next({ request: { headers } });
  if (d.noindex) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|brand/|images/|robots.txt).*)"],
};
