import { describe, expect, it } from "vitest";
import { activeAgo, discussionCta, discussionError, isDiscussionTab, parseDiscussion } from "./discussions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
};

describe("parseDiscussion", () => {
  it("accepts a complete form", () => {
    expect(parseDiscussion(form({ title: " Hiring  your first 10 ", description: "Roles", category: "Careers and hiring", tags: "Hiring, hiring, Ops", limit: "25", privacy: "request" }))).toEqual({
      ok: true,
      value: { title: "Hiring your first 10", description: "Roles", category: "Careers and hiring", tags: ["Hiring", "Ops"], limit: 25, privacy: "request", community: null },
    });
  });
  it("checks limits, categories and privacy", () => {
    const base = { title: "Title", category: "Other", privacy: "public" };
    expect(parseDiscussion(form({ ...base, limit: "1" })).ok).toBe(false);
    expect(parseDiscussion(form({ ...base, limit: "501" })).ok).toBe(false);
    expect(parseDiscussion(form({ ...base, limit: "2.5" })).ok).toBe(false);
    expect(parseDiscussion(form({ ...base, limit: "10", category: "Gossip" })).ok).toBe(false);
    expect(parseDiscussion(form({ ...base, limit: "10", privacy: "secret" })).ok).toBe(false);
    expect(parseDiscussion(form({ ...base, limit: "10", title: "Hi" })).ok).toBe(false);
  });
});

describe("helpers", () => {
  const room = { privacy: "public" as const, my_role: null, my_status: null, members: 3, member_limit: 10, status: "open" as const };
  it("names the next step", () => {
    expect(discussionCta(room)).toBe("Join");
    expect(discussionCta({ ...room, members: 10 })).toBe("Read (full)");
    expect(discussionCta({ ...room, privacy: "request" })).toBe("Ask to join");
    expect(discussionCta({ ...room, my_status: "active", my_role: "member" })).toBe("Open");
    expect(discussionCta({ ...room, status: "closed" })).toBe("Read");
  });
  it("says how recently a room was active", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    expect(activeAgo(null, now)).toBe("No messages yet");
    expect(activeAgo("2026-11-24T11:48:00Z", now)).toBe("Active 12 min ago");
    expect(activeAgo("2026-11-24T09:00:00Z", now)).toBe("Active 3 h ago");
    expect(activeAgo("2026-11-23T10:00:00Z", now)).toBe("Active yesterday");
  });
  it("checks tabs and errors", () => {
    expect(isDiscussionTab("joined")).toBe(true);
    expect(isDiscussionTab("feed")).toBe(false);
    expect(discussionError("ERROR: room_full")).toBe("This discussion is full.");
  });
});
