import { describe, expect, it } from "vitest";
import { communityCta, communityError, isCommunityTab, parseCommunity, parseTopics } from "./communities";

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
