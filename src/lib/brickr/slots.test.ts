import { describe, expect, it } from "vitest";
import { nextWorkingDays, slotToISO } from "./slots";

describe("meeting slots", () => {
  it("offers the next 5 working days, skipping Friday and Saturday", () => {
    // Thursday 12 Nov 2026, 10:00 Cairo
    const days = nextWorkingDays(new Date("2026-11-12T08:00:00Z"));
    expect(days.map((d) => d.date)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(days.map((d) => d.dow)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu"]);
    expect(days[0]).toMatchObject({ day: "15", month: "Nov" });
  });
  it("uses the Cairo date near midnight", () => {
    // 23:30 UTC on 10 Nov is 01:30 on Wed 11 Nov in Cairo, so the first day is Thu 12 Nov
    expect(nextWorkingDays(new Date("2026-11-10T23:30:00Z"))[0].date).toBe("2026-11-12");
  });
  it("accepts only offered days and slots, in Cairo time", () => {
    const now = new Date("2026-11-12T08:00:00Z");
    expect(slotToISO("2026-11-15", "10:00", now)).toBe("2026-11-15T08:00:00.000Z");
    expect(slotToISO("2026-11-14", "10:00", now)).toBeNull();
    expect(slotToISO("2026-11-15", "09:00", now)).toBeNull();
    expect(slotToISO("2026-12-30", "10:00", now)).toBeNull();
  });
});
