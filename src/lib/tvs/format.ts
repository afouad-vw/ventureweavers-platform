/** TVS labels and rules shared by member and admin screens. */

export type ProgramStatus = "draft" | "open" | "in_development" | "closed";
export const PROGRAM_STATUSES: { value: ProgramStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "in_development", label: "In development" },
  { value: "closed", label: "Closed" },
];
export const PROGRAM_KINDS = ["Foundation", "360 program"] as const;

export type ApplicationStatus = "new" | "intro_call" | "proposal" | "won" | "declined";
/** The prototype's board: New → Intro call → Proposal → Won, or Declined. */
export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "intro_call", label: "Intro call" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "declined", label: "Declined" },
];
export const applicationLabel = (s: string) => APPLICATION_STATUSES.find((x) => x.value === s)?.label ?? s;
/** Board columns an admin can move a card to with the arrow buttons. Won only happens through an offer. */
export function nextStatus(s: ApplicationStatus): ApplicationStatus | null {
  return s === "new" ? "intro_call" : s === "intro_call" ? "proposal" : null;
}
export function previousStatus(s: ApplicationStatus): ApplicationStatus | null {
  return s === "intro_call" ? "new" : s === "proposal" ? "intro_call" : null;
}

export type EnrolmentStatus = "offered" | "confirmed" | "cancelled";
export const enrolmentLabel = (s: string) => (s === "offered" ? "Waiting for payment" : s === "confirmed" ? "Enrolled" : "Cancelled");

export const COHORT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "finished", label: "Finished" },
] as const;

export type ProgramCardState =
  | { kind: "apply" }
  | { kind: "applied"; status: ApplicationStatus }
  | { kind: "offered" }
  | { kind: "enrolled" }
  | { kind: "dates" }
  | { kind: "notify"; on: boolean };

/**
 * Which button a program card shows for this member:
 * the foundation program takes applications; other open programs show their dates;
 * programs in development offer Notify me.
 */
export function programCardState(
  p: { id: string; kind: string; status: string },
  mine: { applications: { program_id: string; status: ApplicationStatus }[]; enrolledPrograms: Map<string, EnrolmentStatus>; interests: Set<string> },
): ProgramCardState {
  if (p.status === "in_development") return { kind: "notify", on: mine.interests.has(p.id) };
  const en = mine.enrolledPrograms.get(p.id);
  if (en === "confirmed") return { kind: "enrolled" };
  if (en === "offered") return { kind: "offered" };
  if (p.kind !== "Foundation") return { kind: "dates" };
  const open = mine.applications.find((a) => a.program_id === p.id && a.status !== "declined");
  return open ? { kind: "applied", status: open.status } : { kind: "apply" };
}
