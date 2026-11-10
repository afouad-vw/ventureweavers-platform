import { describe, expect, it } from "vitest";
import { assignmentState, dueWithinDay, isPast, moduleStates, nextSession, overallProgress } from "./classroom";

const now = new Date("2026-11-16T10:00:00Z").getTime();
const day = 86400000;
const iso = (ms: number) => new Date(ms).toISOString();

const modules = [
  { id: "m1", position: 1, title: "Foundations", opens_at: iso(now - 14 * day) },
  { id: "m2", position: 2, title: "Fit", opens_at: iso(now - 7 * day) },
  { id: "m3", position: 3, title: "Customer", opens_at: iso(now - day) },
  { id: "m4", position: 4, title: "Model", opens_at: iso(now + 6 * day) },
  { id: "m5", position: 5, title: "Money", opens_at: iso(now + 13 * day) },
  { id: "m6", position: 6, title: "Team", opens_at: null },
];
const steps = [
  { id: "s1", module_id: "m1" },
  { id: "s2", module_id: "m2" },
  { id: "s3", module_id: "m3" },
  { id: "s4", module_id: "m3" },
  { id: "s5", module_id: "m4" },
];

describe("classroom progress", () => {
  it("gives each module a state", () => {
    const st = moduleStates(modules, steps, new Set(["s1", "s3"]), now);
    expect(st.map((m) => m.state)).toEqual(["completed", "open", "in_progress", "next", "locked", "locked"]);
    expect(st[2].pct).toBe(50);
    expect(st[0].pct).toBe(100);
  });
  it("orders by position even when given out of order", () => {
    expect(moduleStates([...modules].reverse(), steps, new Set(), now).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6"]);
  });
  it("counts overall progress across all steps", () => {
    expect(overallProgress(steps, new Set(["s1", "s3"]))).toBe(40);
    expect(overallProgress([], new Set())).toBe(0);
  });
});

describe("assignments", () => {
  const a = { id: "a1", module_id: "m3", due_at: iso(now + 2 * day) };
  it("follows the module and the hand-in", () => {
    expect(assignmentState(a, false, undefined, now)).toBe("Locked");
    expect(assignmentState(a, true, undefined, now)).toBe("Due");
    expect(assignmentState({ ...a, due_at: iso(now - day) }, true, undefined, now)).toBe("Overdue");
    expect(assignmentState(a, true, { assignment_id: "a1", status: "submitted" }, now)).toBe("Submitted");
    expect(assignmentState(a, true, { assignment_id: "a1", status: "reviewed" }, now)).toBe("Reviewed");
  });
});

describe("sessions and reminders", () => {
  const sessions = [
    { id: "x1", starts_at: iso(now - 7 * day) },
    { id: "x2", starts_at: iso(now - 3600000) },
    { id: "x3", starts_at: iso(now + 2 * day) },
  ];
  it("finds the next live session, counting one that started an hour ago", () => {
    expect(nextSession(sessions, now)?.id).toBe("x2");
    expect(nextSession(sessions, now + 2 * 3600000)?.id).toBe("x3");
    expect(isPast(sessions[0], now)).toBe(true);
    expect(isPast(sessions[1], now)).toBe(false);
  });
  it("knows what's due within a day", () => {
    expect(dueWithinDay(iso(now + 20 * 3600000), now)).toBe(true);
    expect(dueWithinDay(iso(now + 30 * 3600000), now)).toBe(false);
    expect(dueWithinDay(iso(now - 1000), now)).toBe(false);
    expect(dueWithinDay(null, now)).toBe(false);
  });
});
