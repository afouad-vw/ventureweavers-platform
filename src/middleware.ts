import { NextResponse, type NextRequest } from "next/server";
import { decide, hostConfig, SURFACE_HEADER } from "@/lib/hosts";
import { isOpenPath } from "@/lib/open-paths";
import { refreshSession } from "@/lib/supabase/middleware";

const NOT_FOUND = "/__not-found";


export async function middleware(req: NextRequest) {
  const d = decide(req.headers.get("host"), req.nextUrl.pathname, hostConfig());

  if (d.kind === "redirect") return NextResponse.redirect(new URL(d.url + req.nextUrl.search), 308);

  // Never trust a surface header sent by the browser.
  const headersFor = () => {
    const h = new Headers(req.headers);
    h.delete(SURFACE_HEADER);
    // Where the member was going, so the app can send them to "About you" and back.
    h.set("x-vw-path", (req.nextUrl.pathname + req.nextUrl.search).slice(0, 500));
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
  if (d.surface === "site") return build();
  const { res, signedIn } = await refreshSession(req, build);

  // Member app: signed-out visitors see the sign-in page, then come back to where they were going.
  const path = req.nextUrl.pathname;
  const memberApp = d.surface === "app" || (d.surface === "path" && path !== "/admin" && !path.startsWith("/admin/"));
  if (memberApp && !signedIn && !isOpenPath(path)) {
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", path + req.nextUrl.search);
    const r = NextResponse.redirect(to, 307);
    r.headers.set("X-Robots-Tag", "noindex, nofollow");
    return r;
  }
  return res;
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|brand/|images/|robots.txt).*)"],
};
