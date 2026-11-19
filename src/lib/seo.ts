import { hostConfig } from "./hosts";

/** Search-engine setup per address: the landing page is indexed, the member app only its public pages, the admin console never. */
export type SeoHost = "site" | "app" | "admin" | "other";

export function seoHost(rawHost: string | null, cfg = hostConfig()): SeoHost {
  const host = (rawHost ?? "").toLowerCase().replace(/:\d+$/, "");
  if (host === cfg.site || host === "www." + cfg.site) return "site";
  if (host === cfg.app) return "app";
  if (host === cfg.admin) return "admin";
  return "other";
}

/** Public member-app pages worth indexing (everything else sits behind sign-in). */
export const APP_PUBLIC_PATHS = ["/join", "/sign-in", "/privacy", "/terms"];

export function robotsFor(host: SeoHost, cfg = hostConfig()) {
  if (host === "site") return { rules: [{ userAgent: "*", allow: "/", disallow: ["/site", "/admin"] }], sitemap: `https://${cfg.site}/sitemap.xml`, host: `https://${cfg.site}` };
  if (host === "app") return { rules: [{ userAgent: "*", allow: APP_PUBLIC_PATHS, disallow: "/" }], sitemap: `https://${cfg.app}/sitemap.xml` };
  // Admin console and previews (*.vercel.app, localhost): nothing to index.
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}

export function sitemapFor(host: SeoHost, now = new Date(), cfg = hostConfig()) {
  if (host === "site") return [{ url: `https://${cfg.site}/`, lastModified: now, changeFrequency: "weekly" as const, priority: 1 }];
  if (host === "app") return APP_PUBLIC_PATHS.map((p) => ({ url: `https://${cfg.app}${p}`, lastModified: now, changeFrequency: "monthly" as const, priority: p === "/join" ? 0.8 : 0.3 }));
  return [];
}
