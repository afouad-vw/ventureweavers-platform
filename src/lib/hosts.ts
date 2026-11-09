/**
 * Which part of the platform each address serves.
 *
 *   ventureweavers.com        landing page (who we are)
 *   app.ventureweavers.com    member app
 *   admin.ventureweavers.com  admin console (URLs have no /admin prefix there)
 *
 * Any other host (localhost, *.vercel.app previews) keeps path mode, where
 * everything is reachable by path: /, /admin, /site. Set HOST_MODE=strict in
 * Vercel production once the domains are live to send unknown hosts to the app.
 */

export type HostConfig = { site: string; app: string; admin: string; strict: boolean };

export function hostConfig(env: Record<string, string | undefined> = process.env): HostConfig {
  return {
    site: (env.SITE_HOST ?? "ventureweavers.com").toLowerCase(),
    app: (env.APP_HOST ?? "app.ventureweavers.com").toLowerCase(),
    admin: (env.ADMIN_HOST ?? "admin.ventureweavers.com").toLowerCase(),
    strict: env.HOST_MODE === "strict",
  };
}

/** Internal path of the landing page; only reachable as "/" on the site host (or by path in path mode). */
export const SITE_PATH = "/site";
/** Request header the middleware sets so server components know where they are. */
export const SURFACE_HEADER = "x-vw-surface";
export type Surface = "site" | "app" | "admin" | "path";

export type Decision =
  | { kind: "next"; surface: Surface; noindex?: boolean }
  | { kind: "rewrite"; path: string; surface: Surface; noindex?: boolean }
  | { kind: "redirect"; url: string }
  | { kind: "notfound" };

const isUnder = (path: string, base: string) => path === base || path.startsWith(base + "/");

export function decide(rawHost: string | null, pathname: string, cfg: HostConfig): Decision {
  const host = (rawHost ?? "").toLowerCase().replace(/:\d+$/, "");
  const admin = isUnder(pathname, "/admin");
  const site = isUnder(pathname, SITE_PATH);

  if (host === "www." + cfg.site) return { kind: "redirect", url: `https://${cfg.site}${pathname}` };

  if (host === cfg.admin) {
    // Shared auth routes (/auth/confirm for invites) stay as they are; they check the surface themselves.
    if (isUnder(pathname, "/auth")) return { kind: "next", surface: "admin", noindex: true };
    // Canonical admin URLs have no /admin prefix.
    if (admin) return { kind: "redirect", url: `https://${cfg.admin}${pathname.slice(6) || "/"}` };
    if (site) return { kind: "notfound" };
    return { kind: "rewrite", path: "/admin" + (pathname === "/" ? "" : pathname), surface: "admin", noindex: true };
  }

  if (host === cfg.app) {
    if (admin || site) return { kind: "notfound" };
    return { kind: "next", surface: "app" };
  }

  if (host === cfg.site) {
    if (admin || site) return { kind: "notfound" };
    if (pathname === "/") return { kind: "rewrite", path: SITE_PATH, surface: "site" };
    return { kind: "redirect", url: `https://${cfg.app}${pathname}` };
  }

  // Unknown host: previews, localhost, the *.vercel.app production alias.
  if (cfg.strict) {
    if (admin) return { kind: "notfound" };
    return { kind: "redirect", url: `https://${cfg.app}${pathname}` };
  }
  return { kind: "next", surface: "path", noindex: true };
}

/** Prefix that admin links need on this surface: none on the admin host, /admin elsewhere. */
export function adminBase(surface: string | null) {
  return surface === "admin" ? "" : "/admin";
}

/** Turn an /admin/... link into the right one for this surface. */
export function adminHref(href: string, base: string) {
  const rest = href.replace(/^\/admin/, "");
  return base + rest || "/";
}
