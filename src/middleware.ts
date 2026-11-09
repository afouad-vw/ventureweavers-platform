import { NextResponse, type NextRequest } from "next/server";
import { decide, hostConfig, SURFACE_HEADER } from "@/lib/hosts";
import { refreshSession } from "@/lib/supabase/middleware";

const NOT_FOUND = "/__not-found";

export async function middleware(req: NextRequest) {
  const d = decide(req.headers.get("host"), req.nextUrl.pathname, hostConfig());

  if (d.kind === "redirect") return NextResponse.redirect(new URL(d.url + req.nextUrl.search), 308);

  // Never trust a surface header sent by the browser.
  const headersFor = () => {
    const h = new Headers(req.headers);
    h.delete(SURFACE_HEADER);
    if (d.kind !== "notfound") h.set(SURFACE_HEADER, d.surface);
    return h;
  };

  if (d.kind === "notfound") {
    return NextResponse.rewrite(new URL(NOT_FOUND, req.url), { request: { headers: headersFor() } });
  }

  const build = () => {
    const res =
      d.kind === "rewrite"
        ? NextResponse.rewrite(new URL(d.path + req.nextUrl.search, req.url), { request: { headers: headersFor() } })
        : NextResponse.next({ request: { headers: headersFor() } });
    if (d.noindex) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  };

  // The landing page has no accounts; everything else keeps the sign-in session fresh.
  return d.surface === "site" ? build() : refreshSession(req, build);
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|brand/|images/|robots.txt).*)"],
};
