import { describe, expect, it } from "vitest";
import { badgeText, safeHref, unreadCount } from "./format";

describe("notifications", () => {
  it("counts unread", () => {
    expect(unreadCount([{ read_at: null }, { read_at: "2026-11-10T10:00:00Z" }, { read_at: null }])).toBe(2);
  });
  it("caps the badge at 9+", () => {
    expect(badgeText(0)).toBe("");
    expect(badgeText(3)).toBe("3");
    expect(badgeText(12)).toBe("9+");
  });
  it("only follows links inside the app", () => {
    expect(safeHref("/my-space?tab=payments")).toBe("/my-space?tab=payments");
    expect(safeHref("//evil.example")).toBe("/my-space");
    expect(safeHref("https://evil.example")).toBe("/my-space");
  });
});
