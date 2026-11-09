import { describe, expect, it } from "vitest";
import { adminSessionVerdict, allowedOtpType, clientIp, isLockedOut, safeNext } from "./policy";

describe("lockout", () => {
  it("allows up to four failures", () => {
    expect(isLockedOut({ byUsername: 4, byIp: 4 })).toBe(false);
  });
  it("locks on five failures for a username or an IP", () => {
    expect(isLockedOut({ byUsername: 5, byIp: 0 })).toBe(true);
    expect(isLockedOut({ byUsername: 0, byIp: 5 })).toBe(true);
  });
});

describe("admin sessions", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const H = 3_600_000;
  it("keeps a fresh session", () => {
    expect(adminSessionVerdict({ createdAt: ago(H), lastSeenAt: ago(60_000), revokedAt: null }, now)).toBe("ok");
  });
  it("records activity every few minutes", () => {
    expect(adminSessionVerdict({ createdAt: ago(H), lastSeenAt: ago(6 * 60_000), revokedAt: null }, now)).toBe("touch");
  });
  it("ends after 12 idle hours", () => {
    expect(adminSessionVerdict({ createdAt: ago(13 * H), lastSeenAt: ago(12 * H + 1), revokedAt: null }, now)).toBe("expired");
  });
  it("ends after 7 days even when active", () => {
    expect(adminSessionVerdict({ createdAt: ago(7 * 24 * H + 1), lastSeenAt: ago(1000), revokedAt: null }, now)).toBe("expired");
  });
  it("ends when revoked", () => {
    expect(adminSessionVerdict({ createdAt: ago(H), lastSeenAt: ago(1000), revokedAt: ago(10) }, now)).toBe("expired");
  });
});

describe("safeNext", () => {
  it("keeps relative paths", () => expect(safeNext("/tvs/classroom?x=1")).toBe("/tvs/classroom?x=1"));
  it("blocks other sites", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, "/x\r\nSet-Cookie: a"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});

describe("clientIp", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  it("takes the first forwarded address", () => expect(clientIp(h({ "x-forwarded-for": "41.1.2.3, 10.0.0.1" }))).toBe("41.1.2.3"));
  it("rejects junk", () => expect(clientIp(h({ "x-forwarded-for": "<script>" }))).toBeNull());
});

describe("email link types", () => {
  it("admin host accepts only invites", () => {
    expect(allowedOtpType("admin", "invite")).toBe(true);
    expect(allowedOtpType("admin", "recovery")).toBe(false);
    expect(allowedOtpType("admin", "email")).toBe(false);
  });
  it("app host never accepts invites", () => {
    expect(allowedOtpType("app", "invite")).toBe(false);
    expect(allowedOtpType("app", "recovery")).toBe(true);
  });
});
