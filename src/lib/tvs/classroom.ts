/** Classroom rules shared by the learner view, the admin view and the reminder emails. */

export type ModuleLite = { id: string; position: number; title: string; opens_at: string | null };
export type StepLite = { id: string; module_id: string };
export type AssignmentLite = { id: string; module_id: string; due_at: string | null };
export type SubmissionLite = { assignment_id: string; status: "submitted" | "reviewed" };
export type SessionLite = { id: string; starts_at: string };

export const isOpen = (m: { opens_at: string | null }, now = Date.now()) => m.opens_at !== null && new Date(m.opens_at).getTime() <= now;

export type ModuleState = "completed" | "in_progress" | "open" | "next" | "locked";

/**
 * Each module's state for a learner: completed (all steps ticked), in progress (some ticked),
 * open, opens next (the first locked one with a date), or locked.
 */
export function moduleStates(modules: ModuleLite[], steps: StepLite[], done: Set<string>, now = Date.now()) {
  const sorted = [...modules].sort((a, b) => a.position - b.position);
  let nextMarked = false;
  return sorted.map((m) => {
    const mine = steps.filter((s) => s.module_id === m.id);
    const ticked = mine.filter((s) => done.has(s.id)).length;
    const pct = mine.length ? Math.round((ticked / mine.length) * 100) : 0;
    let state: ModuleState;
    if (!isOpen(m, now)) {
      state = !nextMarked && m.opens_at ? "next" : "locked";
      if (state === "next") nextMarked = true;
    } else if (mine.length && ticked === mine.length) state = "completed";
    else if (ticked > 0) state = "in_progress";
    else state = "open";
    return { ...m, state, pct, steps: mine.length, ticked };
  });
}

/** Overall progress: ticked steps out of all steps in the cohort, 0–100. */
export function overallProgress(steps: StepLite[], done: Set<string>) {
  if (!steps.length) return 0;
  return Math.round((steps.filter((s) => done.has(s.id)).length / steps.length) * 100);
}

export type AssignmentState = "Locked" | "Due" | "Overdue" | "Submitted" | "Reviewed";

export function assignmentState(a: AssignmentLite, moduleOpen: boolean, sub: SubmissionLite | undefined, now = Date.now()): AssignmentState {
  if (sub) return sub.status === "reviewed" ? "Reviewed" : "Submitted";
  if (!moduleOpen) return "Locked";
  if (a.due_at && new Date(a.due_at).getTime() < now) return "Overdue";
  return "Due";
}

/** The next live session that hasn't ended (sessions count as live for 2 hours after they start). */
export function nextSession<T extends SessionLite>(sessions: T[], now = Date.now()): T | null {
  return [...sessions].filter((s) => new Date(s.starts_at).getTime() + 2 * 3600 * 1000 > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
}

export const isPast = (s: SessionLite, now = Date.now()) => new Date(s.starts_at).getTime() + 2 * 3600 * 1000 <= now;

/** Is a time within the next day? Used by the morning reminder emails. */
export function dueWithinDay(iso: string | null, now = Date.now()) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t > now && t <= now + 24 * 3600 * 1000;
}
