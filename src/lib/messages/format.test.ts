import { describe, expect, it } from "vitest";
import { byDay, cleanMessage, memberUnread, teamUnread } from "./format";

describe("messages", () => {
  it("cleans what members and the team type", () => {
    expect(cleanMessage("  Hello  ")).toBe("Hello");
    expect(cleanMessage("a\r\nb\n\n\n\n\n\nc")).toBe("a\nb\n\n\nc");
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage("x".repeat(2001))).toBeNull();
    expect(cleanMessage(null)).toBeNull();
  });
  it("counts team replies the member hasn't read", () => {
    const msgs = [
      { from_team: false, created_at: "2026-11-17T10:00:00Z" },
      { from_team: true, created_at: "2026-11-17T10:05:00Z" },
      { from_team: true, created_at: "2026-11-17T11:00:00Z" },
    ];
    expect(memberUnread(msgs, null)).toBe(2);
    expect(memberUnread(msgs, "2026-11-17T10:30:00Z")).toBe(1);
    expect(memberUnread(msgs, "2026-11-17T12:00:00Z")).toBe(0);
  });
  it("knows when the team has something new to read", () => {
    expect(teamUnread({ last_member_message_at: "2026-11-17T10:00:00Z", team_read_at: null })).toBe(true);
    expect(teamUnread({ last_member_message_at: "2026-11-17T10:00:00Z", team_read_at: "2026-11-17T10:01:00Z" })).toBe(false);
    expect(teamUnread({ last_member_message_at: null, team_read_at: null })).toBe(false);
  });
  it("groups messages by Cairo day", () => {
    const g = byDay([{ created_at: "2026-11-16T21:00:00Z" }, { created_at: "2026-11-16T23:00:00Z" }, { created_at: "2026-11-17T09:00:00Z" }]);
    expect(g.map((x) => x.items.length)).toEqual([1, 2]);
  });
});
