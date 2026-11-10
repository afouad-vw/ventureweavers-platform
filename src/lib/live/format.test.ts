import { describe, expect, it } from "vitest";
import { liveError, momentLabel, parsePollOptions, pollPercents, queueOrder } from "./format";

describe("poll percentages", () => {
  it("adds up to 100", () => {
    expect(pollPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pollPercents([18, 11, 9]).reduce((a, b) => a + b)).toBe(100);
    expect(pollPercents([2, 0])).toEqual([100, 0]);
  });
  it("is all zero with no votes", () => {
    expect(pollPercents([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("question queue order", () => {
  it("puts waiting first, then votes, then oldest", () => {
    const q = queueOrder([
      { id: "a", status: "approved" as const, votes: 9, created_at: "2026-11-10T10:00:00Z" },
      { id: "b", status: "hidden" as const, votes: 20, created_at: "2026-11-10T10:00:00Z" },
      { id: "c", status: "waiting" as const, votes: 0, created_at: "2026-11-10T10:05:00Z" },
      { id: "d", status: "waiting" as const, votes: 0, created_at: "2026-11-10T10:01:00Z" },
      { id: "e", status: "approved" as const, votes: 12, created_at: "2026-11-10T10:09:00Z" },
    ]);
    expect(q.map((x) => x.id)).toEqual(["d", "c", "e", "a", "b"]);
  });
});

describe("poll options", () => {
  it("cleans lines and drops repeats", () => {
    expect(parsePollOptions(" Hiring \n\nhiring\nWhen to bring in a CFO\n")).toEqual({ ok: true, options: ["Hiring", "When to bring in a CFO"] });
  });
  it("needs 2 to 4 options", () => {
    expect(parsePollOptions("Only one").ok).toBe(false);
    expect(parsePollOptions("a\nb\nc\nd\ne").ok).toBe(false);
    expect(parsePollOptions(`${"x".repeat(81)}\nb`).ok).toBe(false);
  });
});

describe("labels", () => {
  it("names the moments", () => {
    expect(momentLabel(1)).toBe("The Pick");
    expect(momentLabel(4)).toBe("Your Voice");
    expect(momentLabel(9)).toBe("Your Voice");
  });
  it("turns database errors into plain messages", () => {
    expect(liveError("question_limit")).toMatch(/5 questions/);
    expect(liveError("whatever")).toMatch(/try again/);
  });
});
