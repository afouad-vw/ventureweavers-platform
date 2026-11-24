import { describe, expect, it } from "vitest";
import { activityDay, blongError, cleanBio, cleanLinks, followLabel, isNetworkTab, isReportReason, isUuid, memberLine, reviewChip } from "./format";
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
