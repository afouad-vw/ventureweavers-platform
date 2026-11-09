import { describe, expect, it } from "vitest";
import { adminHref, decide, hostConfig } from "./hosts";

const cfg = hostConfig({});
const strict = hostConfig({ HOST_MODE: "strict" });

describe("site host", () => {
  it("serves the landing page at /", () => {
    expect(decide("ventureweavers.com", "/", cfg)).toEqual({ kind: "rewrite", path: "/site", surface: "site" });
  });
  it("sends member pages to the app", () => {
    expect(decide("ventureweavers.com", "/join", cfg)).toEqual({ kind: "redirect", url: "https://app.ventureweavers.com/join" });
  });
  it("never serves the admin console", () => {
    expect(decide("ventureweavers.com", "/admin", cfg).kind).toBe("notfound");
    expect(decide("ventureweavers.com", "/admin/contacts", cfg).kind).toBe("notfound");
  });
  it("redirects www to the bare domain", () => {
    expect(decide("www.ventureweavers.com", "/x", cfg)).toEqual({ kind: "redirect", url: "https://ventureweavers.com/x" });
  });
  it("ignores port and case", () => {
    expect(decide("VentureWeavers.com:443", "/", cfg).kind).toBe("rewrite");
  });
});

describe("app host", () => {
  it("serves member pages", () => {
    expect(decide("app.ventureweavers.com", "/tvs", cfg)).toEqual({ kind: "next", surface: "app" });
  });
  it("never serves the admin console or its sign-in", () => {
    for (const p of ["/admin", "/admin/", "/admin/sign-in", "/admin/payments"]) {
      expect(decide("app.ventureweavers.com", p, cfg).kind).toBe("notfound");
    }
  });
  it("does not expose the landing page path", () => {
    expect(decide("app.ventureweavers.com", "/site", cfg).kind).toBe("notfound");
  });
  it("does not treat look-alike paths as admin", () => {
    expect(decide("app.ventureweavers.com", "/administrator", cfg).kind).toBe("next");
  });
});

describe("admin host", () => {
  it("maps / to the overview, with noindex", () => {
    expect(decide("admin.ventureweavers.com", "/", cfg)).toEqual({ kind: "rewrite", path: "/admin", surface: "admin", noindex: true });
  });
  it("maps clean paths into the console", () => {
    expect(decide("admin.ventureweavers.com", "/sign-in", cfg)).toMatchObject({ kind: "rewrite", path: "/admin/sign-in" });
  });
  it("passes auth routes through, marked as admin", () => {
    expect(decide("admin.ventureweavers.com", "/auth/confirm", cfg)).toEqual({ kind: "next", surface: "admin", noindex: true });
  });
  it("redirects /admin URLs to the clean form", () => {
    expect(decide("admin.ventureweavers.com", "/admin/contacts", cfg)).toEqual({ kind: "redirect", url: "https://admin.ventureweavers.com/contacts" });
    expect(decide("admin.ventureweavers.com", "/admin", cfg)).toEqual({ kind: "redirect", url: "https://admin.ventureweavers.com/" });
  });
});

describe("unknown hosts", () => {
  it("use path mode with noindex by default", () => {
    expect(decide("vw.vercel.app", "/admin", cfg)).toEqual({ kind: "next", surface: "path", noindex: true });
  });
  it("in strict mode send people to the app and hide admin", () => {
    expect(decide("vw.vercel.app", "/tvs", strict)).toEqual({ kind: "redirect", url: "https://app.ventureweavers.com/tvs" });
    expect(decide("vw.vercel.app", "/admin/sign-in", strict).kind).toBe("notfound");
    expect(decide(null, "/admin", strict).kind).toBe("notfound");
  });
});

describe("scheduled jobs", () => {
  it("reach the cron routes on any host, even in strict mode", () => {
    expect(decide("vw.vercel.app", "/api/cron/reminders", strict)).toEqual({ kind: "next", surface: "path", noindex: true });
    expect(decide("admin.ventureweavers.com", "/api/cron/reminders", cfg).kind).toBe("next");
  });
  it("don't open other API routes in strict mode", () => {
    expect(decide("vw.vercel.app", "/api/tickets/VW-AAAA-BBBB/calendar", strict).kind).toBe("redirect");
  });
});

describe("admin links", () => {
  it("drop the prefix on the admin host", () => {
    expect(adminHref("/admin", "")).toBe("/");
    expect(adminHref("/admin/contacts", "")).toBe("/contacts");
  });
  it("keep it in path mode", () => {
    expect(adminHref("/admin", "/admin")).toBe("/admin");
    expect(adminHref("/admin/contacts", "/admin")).toBe("/admin/contacts");
  });
});
