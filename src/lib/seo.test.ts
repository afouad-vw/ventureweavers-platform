import { describe, expect, it } from "vitest";
import { hostConfig } from "./hosts";
import { robotsFor, seoHost, sitemapFor } from "./seo";

const cfg = hostConfig({});

describe("seo per address", () => {
  it("knows which address it is on", () => {
    expect(seoHost("ventureweavers.com", cfg)).toBe("site");
    expect(seoHost("www.ventureweavers.com", cfg)).toBe("site");
    expect(seoHost("app.ventureweavers.com:443", cfg)).toBe("app");
    expect(seoHost("admin.ventureweavers.com", cfg)).toBe("admin");
    expect(seoHost("x.vercel.app", cfg)).toBe("other");
  });
  it("indexes the landing page and points to its sitemap", () => {
    const r = robotsFor("site", cfg);
    expect(r.sitemap).toBe("https://ventureweavers.com/sitemap.xml");
    expect(sitemapFor("site", new Date(0), cfg).map((x) => x.url)).toEqual(["https://ventureweavers.com/"]);
  });
  it("keeps the member app private apart from its public pages", () => {
    expect(robotsFor("app", cfg).rules[0]).toMatchObject({ disallow: "/", allow: ["/join", "/sign-in", "/privacy", "/terms"] });
  });
  it("never indexes the admin console or previews", () => {
    expect(robotsFor("admin", cfg).rules[0]).toEqual({ userAgent: "*", disallow: "/" });
    expect(robotsFor("other", cfg).rules[0]).toEqual({ userAgent: "*", disallow: "/" });
    expect(sitemapFor("admin", new Date(0), cfg)).toEqual([]);
  });
});
