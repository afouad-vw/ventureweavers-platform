import { describe, expect, it } from "vitest";
import { communityCta, communityError, compact, isCommunityTab, parseCommunity, parsePost, parseTopics, threadComments } from "./communities";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

describe("parseTopics", () => {
  it("trims, drops repeats and keeps 8", () => {
    expect(parseTopics("Fundraising, hiring , fundraising,, Hiring")).toEqual(["Fundraising", "hiring"]);
    expect(parseTopics(Array.from({ length: 10 }, (_, i) => `t${i}`).join(","))).toHaveLength(8);
  });
});

describe("parseCommunity", () => {
  const ok = () => true;
  it("accepts a complete form", () => {
    const r = parseCommunity(form({ name: " Founders  in Cairo ", description: "For founders.", type: "Location", topics: "A, B", audience: ["Founder", "Nonsense"], visibility: "private" }), ok);
    expect(r).toEqual({ ok: true, value: { name: "Founders in Cairo", description: "For founders.", type: "Location", topics: ["A", "B"], audience: ["Founder"], visibility: "private", cover: null } });
  });
  it("refuses short names, missing types and foreign covers", () => {
    expect(parseCommunity(form({ name: "AB", description: "d", type: "Location" }), ok).ok).toBe(false);
    expect(parseCommunity(form({ name: "Name", description: "d", type: "Gossip" }), ok).ok).toBe(false);
    expect(parseCommunity(form({ name: "Name", description: "d", type: "Other", cover: "https://evil.example/x.jpg" }), () => false).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("names the call to action", () => {
    expect(communityCta({ visibility: "private", my_role: null, my_status: null })).toBe("Ask to join");
    expect(communityCta({ visibility: "public", my_role: null, my_status: null })).toBe("View");
    expect(communityCta({ visibility: "public", my_role: "member", my_status: "invited" })).toBe("Accept invite");
    expect(communityCta({ visibility: "public", my_role: "admin", my_status: "active" })).toBe("Manage");
  });
  it("checks tabs and errors", () => {
    expect(isCommunityTab("owned")).toBe(true);
    expect(isCommunityTab("feed")).toBe(false);
    expect(communityError("owner_must_transfer")).toMatch(/Hand the community/);
  });
});

describe("posts (19c)", () => {
  it("reads the composer", () => {
    expect(parsePost("  Hello  ", "")).toEqual({ ok: true, body: "Hello", link: null });
    expect(parsePost("Hi", "example.com/a")).toEqual({ ok: true, body: "Hi", link: "https://example.com/a" });
    expect(parsePost("Hi", "http://x.io")).toMatchObject({ link: "https://x.io" });
    expect(parsePost("", "")).toMatchObject({ ok: false });
    expect(parsePost("x".repeat(3001), "")).toMatchObject({ ok: false });
    expect(parsePost("Hi", "not a link")).toMatchObject({ ok: false });
  });
  it("threads comments one level deep", () => {
    const c = (id: string, parent: string | null) => ({ id, parent_id: parent, author: "a", name: "A", avatar_url: null, body: id, mod_status: "live" as const, created_at: "", likes: 0, liked: false });
    const t = threadComments([c("1", null), c("2", "1"), c("3", null), c("4", "1")]);
    expect(t.map((x) => [x.comment.id, x.replies.map((r) => r.id)])).toEqual([["1", ["2", "4"]], ["3", []]]);
  });
  it("shortens big counts", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1200)).toBe("1.2k");
    expect(compact(1000)).toBe("1k");
    expect(compact(25400)).toBe("25k");
  });
});
