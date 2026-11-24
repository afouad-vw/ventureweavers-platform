import { describe, expect, it } from "vitest";
import { activityDay, blongError, cleanBio, cleanLinks, followLabel, isNetworkTab, isReportReason, isUuid, memberLine, parseRules, reviewChip } from "./format";
import { communityError } from "./communities";
import { discussionCta, discussionError } from "./discussions";

describe("followLabel", () => {
  it("asks Private accounts and follows Public ones", () => {
    expect(followLabel("none", "public")).toBe("Follow");
    expect(followLabel("none", "private")).toBe("Ask to follow");
    expect(followLabel("none", "public", true)).toBe("Follow back");
    expect(followLabel("requested", "private")).toBe("Requested");
    expect(followLabel("following", "private")).toBe("Following");
  });
});

describe("cleanLinks", () => {
  it("adds https and drops empty rows", () => {
    expect(cleanLinks([{ label: "Site", url: "example.com" }, { label: "", url: "" }])).toEqual([{ label: "Site", url: "https://example.com" }]);
  });
  it("upgrades http and refuses links without a name or address", () => {
    expect(cleanLinks([{ label: "Blog", url: "http://blog.example.com/x" }])[0].url).toBe("https://blog.example.com/x");
    expect(() => cleanLinks([{ label: "", url: "example.com" }])).toThrow();
    expect(() => cleanLinks([{ label: "Bad", url: "not a link" }])).toThrow();
  });
  it("keeps at most five", () => {
    expect(() => cleanLinks(Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, url: `e${i}.com` })))).toThrow();
  });
});

describe("helpers", () => {
  it("cleans bios", () => {
    expect(cleanBio("  Hello \n world ")).toBe("Hello world");
    expect(cleanBio("   ")).toBeNull();
    expect(cleanBio("x".repeat(400))).toHaveLength(300);
  });
  it("checks values", () => {
    expect(isNetworkTab("requests")).toBe(true);
    expect(isNetworkTab("feed")).toBe(true);
    expect(isNetworkTab("posts")).toBe(false);
    expect(isReportReason("spam")).toBe(true);
    expect(isReportReason("rude")).toBe(false);
    expect(isUuid("00000000-0000-0000-0000-00000000b001")).toBe(true);
    expect(isUuid("1; drop table")).toBe(false);
  });
  it("writes a member line and friendly errors", () => {
    expect(memberLine({ roles: ["Founder", "Mentor", "Expert"], business: "Acme", country: "Egypt" })).toBe("Founder, Mentor · Acme · Egypt");
    expect(blongError("ERROR: cannot_message")).toMatch(/accept your follow/);
  });
});

describe("activityDay", () => {
  it("says Today, Yesterday or the date in Cairo", () => {
    const now = new Date("2026-11-24T10:00:00Z");
    expect(activityDay("2026-11-24T06:00:00Z", now)).toBe("Today");
    expect(activityDay("2026-11-23T20:00:00Z", now)).toBe("Yesterday");
    expect(activityDay("2026-11-03T10:00:00Z", now)).toBe("3 Nov");
  });
});

describe("approval and section switches (19a)", () => {
  it("labels items waiting for review", () => {
    expect(reviewChip("pending")).toEqual({ label: "Waiting for approval", tone: "warn" });
    expect(reviewChip("declined")?.label).toBe("Not approved");
    expect(reviewChip("active")).toBeNull();
    expect(reviewChip("open")).toBeNull();
  });
  it("explains the new database errors", () => {
    expect(communityError("ERROR: section_off")).toMatch(/coming soon/);
    expect(discussionError("ERROR: pending_review")).toMatch(/approval/);
  });
  it("lets the creator open a pending discussion", () => {
    expect(discussionCta({ privacy: "request", my_role: "owner", my_status: "active", members: 1, member_limit: 10, status: "pending" })).toBe("Open");
  });
});

describe("parseRules (19b)", () => {
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const base = { max_links: "2", link_new_days: "7", per_minute: "6", new_member_days: "3", new_member_hold: "2", auto_hide_reports: "3" };
  it("cleans lists and keeps Arabic commas", () => {
    const r = parseRules(form({ ...base, blocked_words: "Scam, scam\nget rich quick،احتيال", blocked_domains: "https://www.Spam.example/path", blocked_action: "reject" }));
    expect(r.ok && r.value.blocked_words).toEqual(["scam", "get rich quick", "احتيال"]);
    expect(r.ok && r.value.blocked_domains).toEqual(["spam.example"]);
    expect(r.ok && r.value.blocked_action).toBe("reject");
  });
  it("refuses numbers out of range", () => {
    expect(parseRules(form({ ...base, auto_hide_reports: "0" })).ok).toBe(false);
    expect(parseRules(form({ ...base, per_minute: "x" })).ok).toBe(false);
  });
});

describe("filters (19d)", async () => {
  const { filterCommunities, filterDiscussions, pick, pickText, topTopics, roomCommunities, filterFeed } = await import("./filters");
  const c = (o: Partial<import("./communities").CommunityRow>) => ({ id: "x", slug: "x", name: "B", description: "", type: "Interest", topics: [], audience: [], visibility: "public", cover_url: null, status: "active", members: 10, my_role: null, my_status: null, created_at: "2026-11-01", ...o }) as import("./communities").CommunityRow;
  const none = { topic: "", audience: "", visibility: "", size: "", sort: "" };
  it("filters and sorts communities", () => {
    const list = [c({ id: "1", name: "B", topics: ["Fintech"], members: 300, created_at: "2026-11-02" }), c({ id: "2", name: "A", visibility: "private", audience: ["Founder"], members: 5 })];
    expect(filterCommunities(list, { ...none, topic: "fin" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterCommunities(list, { ...none, size: "large" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterCommunities(list, { ...none, visibility: "private" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterCommunities(list, { ...none, audience: "Mentor" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterCommunities(list, { ...none, sort: "name" }).map((x) => x.id)).toEqual(["2", "1"]);
    expect(topTopics(list)).toEqual(["Fintech"]);
  });
  it("filters discussions", () => {
    const d = (o: Partial<import("./discussions").DiscussionRow>) => ({ id: "x", slug: "x", title: "T", description: "", category: "Other", tags: [], member_limit: 10, privacy: "public", community_id: null, community_name: null, community_slug: null, status: "open", members: 2, last_message_at: null, my_role: null, my_status: null, ...o }) as import("./discussions").DiscussionRow;
    const list = [d({ id: "1", members: 10, tags: ["Hiring"] }), d({ id: "2", community_id: "c", community_name: "Club", last_message_at: "2026-11-24" })];
    const f = { community: "", privacy: "", status: "", room: false, tag: "", sort: "" };
    expect(filterDiscussions(list, { ...f, room: true }).map((x) => x.id)).toEqual(["2"]);
    expect(filterDiscussions(list, { ...f, community: "none" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterDiscussions(list, { ...f, tag: "hir" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterDiscussions(list, { ...f, sort: "active" }).map((x) => x.id)).toEqual(["2", "1"]);
    expect(roomCommunities(list)).toEqual([{ value: "c", label: "Club" }]);
  });
  it("reads only allowed values", () => {
    expect(pick({ sort: "newest" }, "sort", ["newest"])).toBe("newest");
    expect(pick({ sort: "drop table" }, "sort", ["newest"])).toBe("");
    expect(pickText({ tag: "  HiRing " }, "tag")).toBe("hiring");
    expect(filterFeed([{ kind: "post" }, { kind: "events" }] as never[], "post")).toHaveLength(1);
  });
});
