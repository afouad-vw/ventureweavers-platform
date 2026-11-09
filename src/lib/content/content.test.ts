import { describe, expect, it } from "vitest";
import { buildReminders, cleanLink, filterBySpace, parseTags, profileCompletion, relativeWhen, tunedTo } from "./format";
import { markdownText, parseInline, parseMarkdown, readTime, safeHref } from "./markdown";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe";

describe("markdown", () => {
  it("reads headings, paragraphs, lists, quotes and dividers", () => {
    const b = parseMarkdown("## Pricing\n\nAnchor to **value**.\nReview *quarterly*.\n\n- one\n- two\n\n1. first\n2. second\n\n> A quote\n> continues\n\n---\n\n### Small");
    expect(b.map((x) => x.t)).toEqual(["h2", "p", "ul", "ol", "quote", "hr", "h3"]);
    expect(b[1]).toEqual({ t: "p", c: [{ t: "text", v: "Anchor to " }, { t: "strong", c: [{ t: "text", v: "value" }] }, { t: "text", v: ". Review " }, { t: "em", c: [{ t: "text", v: "quarterly" }] }, { t: "text", v: "." }] });
    expect(b[2]).toEqual({ t: "ul", items: [[{ t: "text", v: "one" }], [{ t: "text", v: "two" }]] });
    expect(b[4]).toEqual({ t: "quote", c: [{ t: "text", v: "A quote continues" }] });
  });

  it("treats pasted text as plain paragraphs", () => {
    const b = parseMarkdown("First paragraph.\n\nSecond paragraph.");
    expect(b).toEqual([{ t: "p", c: [{ t: "text", v: "First paragraph." }] }, { t: "p", c: [{ t: "text", v: "Second paragraph." }] }]);
  });

  it("keeps HTML as text, never as markup", () => {
    const b = parseMarkdown('<script>alert(1)</script> <img src=x onerror="x">');
    expect(b).toEqual([{ t: "p", c: [{ t: "text", v: '<script>alert(1)</script> <img src=x onerror="x">' }] }]);
  });

  it("only links https, mailto and app paths", () => {
    expect(parseInline("[ok](https://ventureweavers.com)")).toEqual([{ t: "link", href: "https://ventureweavers.com", c: [{ t: "text", v: "ok" }] }]);
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "x" }, { t: "text", v: ")" }]);
    expect(parseInline("[x](data:text/html,hi)")).toEqual([{ t: "text", v: "x" }]);
    expect(safeHref("/outloud?tab=blog")).toBe("/outloud?tab=blog");
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("http://insecure.example")).toBeNull();
    expect(safeHref("mailto:info@ventureweavers.com")).toBe("mailto:info@ventureweavers.com");
  });

  it("handles code, escapes and unclosed marks", () => {
    expect(parseInline("use `npm test` now")).toEqual([{ t: "text", v: "use " }, { t: "code", v: "npm test" }, { t: "text", v: " now" }]);
    expect(parseInline("2 * 3 = 6")).toEqual([{ t: "text", v: "2 * 3 = 6" }]);
    expect(parseInline("\\*not italic\\*")).toEqual([{ t: "text", v: "*not italic*" }]);
    expect(parseInline("**open")).toEqual([{ t: "text", v: "**open" }]);
  });

  it("gives plain text and read time", () => {
    expect(markdownText("## Title\n\n**Bold** words")).toBe("Title\n\nBold words");
    expect(readTime("word ".repeat(1000))).toBe("5 min");
    expect(readTime("short")).toBe("1 min");
  });
});

describe("content helpers", () => {
  it("parses tags", () => {
    expect(parseTags(" Pricing, CFO ,, angels, pricing ")).toEqual(["Pricing", "CFO", "angels"]);
    expect(parseTags(Array.from({ length: 12 }, (_, i) => `t${i}`).join(","))).toHaveLength(8);
  });

  it("checks links like the database", () => {
    expect(cleanLink("")).toBeNull();
    expect(cleanLink("/library")).toBe("/library");
    expect(cleanLink("https://instagram.com/openfloor.show")).toBe("https://instagram.com/openfloor.show");
    expect(cleanLink("javascript:alert(1)")).toBe("invalid");
    expect(cleanLink("//evil.example")).toBe("invalid");
    expect(cleanLink("http://x.example")).toBe("invalid");
  });

  it("filters the feed by space", () => {
    const items = [{ space: "Outloud" }, { space: "TVS" }, { space: "House" }];
    expect(filterBySpace(items, "All")).toHaveLength(3);
    expect(filterBySpace(items, "TVS")).toEqual([{ space: "TVS" }]);
    expect(filterBySpace(items, "House")).toEqual([{ space: "House" }]);
    expect(filterBySpace(items, "nonsense")).toHaveLength(3);
  });

  it("says when", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(relativeWhen("2026-11-09T11:59:40Z", now)).toBe("Just now");
    expect(relativeWhen("2026-11-09T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeWhen("2026-11-07T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeWhen("2026-11-01T12:00:00Z", now)).toBe("1 week ago");
    expect(relativeWhen("2026-10-26T12:00:00Z", now)).toBe("2 weeks ago");
  });

  it("builds reminders: payments due and events this week, soonest first", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const ev = (slug: string, days: number) => ({ slug, title: slug, starts_at: new Date(now.getTime() + days * 86400000).toISOString() });
    const r = buildReminders(
      [
        { id: "a", status: "confirmed", seats: 1, hold_expires_at: null, events: ev("in-3-days", 3) },
        { id: "b", status: "confirmed", seats: 1, hold_expires_at: null, events: ev("in-10-days", 10) },
        { id: "c", status: "reserved", seats: 2, hold_expires_at: new Date(now.getTime() + 3600000).toISOString(), events: ev("to-pay", 11) },
        { id: "d", status: "reserved", seats: 1, hold_expires_at: new Date(now.getTime() - 1000).toISOString(), events: ev("lapsed", 5) },
        { id: "e", status: "cancelled", seats: 1, hold_expires_at: null, events: ev("cancelled", 2) },
        { id: "f", status: "confirmed", seats: 1, hold_expires_at: null, events: ev("past", -1) },
      ],
      now,
    );
    expect(r.map((x) => x.key)).toEqual(["pay-c", "ev-a"]);
    expect(r[0].cta).toBe("Pay");
  });

  it("measures profile completion and the feed line", () => {
    expect(profileCompletion(null)).toBe(0);
    expect(profileCompletion({ full_name: "Nour", role: "Founder", stage: "Seed", interests: ["Growth"], goals: [], phone: null, avatar_url: null })).toBe(57);
    expect(tunedTo({ role: "Founder", stage: "Seed", interests: ["Growth", "Fundraising", "Hiring", "Pricing"] })).toBe("founder · seed · growth, fundraising, hiring");
    expect(tunedTo(null)).toBe("");
  });
});

describe("unsubscribe links", () => {
  const id = "00000000-0000-0000-0000-0000000000b1";
  it("verifies only the member's own token", () => {
    const t = unsubscribeToken(id, "secret-a");
    expect(verifyUnsubscribe(id, t, "secret-a")).toBe(true);
    expect(verifyUnsubscribe("00000000-0000-0000-0000-0000000000b2", t, "secret-a")).toBe(false);
    expect(verifyUnsubscribe(id, t, "secret-b")).toBe(false);
    expect(verifyUnsubscribe(id, "x".repeat(32), "secret-a")).toBe(false);
    expect(verifyUnsubscribe("not-an-id", t, "secret-a")).toBe(false);
  });
  it("builds the link", () => {
    expect(unsubscribeUrl("https://app.ventureweavers.com", id, "s")).toMatch(/^https:\/\/app\.ventureweavers\.com\/api\/unsubscribe\?u=0{8}-0{4}-0{4}-0{4}-0{10}b1&t=[A-Za-z0-9_-]{32}$/);
  });
});
