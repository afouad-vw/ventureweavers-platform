/** BRICKR client projects (Phase 17): labels and rules shared by member and admin screens. */

export type ProjectKind = "portfolio" | "venture";
export type ProjectStatus = "setup" | "assessment" | "proposal" | "active" | "paused" | "completed" | "cancelled";
export type Health = "green" | "amber" | "red";
export type Currency = "EGP" | "USD";
export type ProjectRole = "lead" | "team";
export type RequestStatus = "submitted" | "in_review" | "quoted" | "approved" | "client_declined" | "declined" | "in_progress" | "done" | "cancelled";
export type MeetingKind = "kickoff" | "weekly" | "review" | "checkin" | "other";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "setup", label: "Set-up" },
  { value: "assessment", label: "Assessment" },
  { value: "proposal", label: "Proposal" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
export const projectStatusLabel = (s: string) => PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s;
export const projectStatusTone = (s: string): "ok" | "blue" | "warn" | "draft" =>
  s === "active" ? "ok" : s === "assessment" || s === "proposal" || s === "setup" ? "blue" : s === "paused" ? "warn" : "draft";

export const HEALTH: { value: Health; label: string; colour: string }[] = [
  { value: "green", label: "On track", colour: "#29BE9C" },
  { value: "amber", label: "Needs attention", colour: "#E39B2D" },
  { value: "red", label: "At risk", colour: "#C2410C" },
];
export const healthOf = (h: string) => HEALTH.find((x) => x.value === h) ?? HEALTH[0];

export const SERVICES = [
  { value: "fractional_leadership", label: "Fractional leadership" },
  { value: "mentorship", label: "Mentorship" },
] as const;
export const serviceLabel = (s: string) => SERVICES.find((x) => x.value === s)?.label ?? s;

/** The four dimensions from the fractional leadership proposal (governance and support run through all of them). */
export const DEFAULT_DIMENSIONS = ["Portfolio Strategy", "Venture Building", "Venture Scaling", "Positioning"];

export const ROLE_LABEL: Record<ProjectRole, string> = { lead: "Client lead", team: "Team member" };

export const REQUEST_STATUSES: { value: RequestStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In review" },
  { value: "quoted", label: "Quote sent" },
  { value: "approved", label: "Approved" },
  { value: "client_declined", label: "Declined by client" },
  { value: "declined", label: "Declined" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];
export const requestStatusLabel = (s: string) => REQUEST_STATUSES.find((x) => x.value === s)?.label ?? s;
export const requestTone = (s: string): "ok" | "blue" | "warn" | "draft" =>
  s === "approved" || s === "in_progress" || s === "done" ? "ok" : s === "quoted" || s === "in_review" || s === "submitted" ? "blue" : s === "declined" || s === "client_declined" ? "warn" : "draft";
export const isOpenRequest = (s: string) => !["done", "declined", "client_declined", "cancelled"].includes(s);

/**
 * The next steps staff can take on a request. Approval is the client lead's; paid work can only start once approved.
 */
export function staffRequestMoves(r: { status: string; price: number | null }): RequestStatus[] {
  switch (r.status) {
    case "submitted":
      return ["in_review", "quoted", "declined"];
    case "in_review":
      return ["quoted", "declined"];
    case "quoted":
      return (r.price ?? 0) > 0 ? ["in_review", "declined", "cancelled"] : ["in_progress", "in_review", "declined"];
    case "approved":
      return ["in_progress", "cancelled"];
    case "in_progress":
      return ["done", "cancelled"];
    case "client_declined":
      return ["in_review", "cancelled"];
    default:
      return [];
  }
}

export const MEETING_KINDS: { value: MeetingKind; label: string }[] = [
  { value: "kickoff", label: "Kick-off" },
  { value: "weekly", label: "Weekly session" },
  { value: "review", label: "Review" },
  { value: "checkin", label: "Check-in" },
  { value: "other", label: "Other" },
];
export const meetingKindLabel = (k: string) => MEETING_KINDS.find((x) => x.value === k)?.label ?? k;

/** "USD 3,000" / "EGP 12,500.50"; "TBA" when unknown. */
export function formatMoney(amount: number | string | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || amount === "") return "TBA";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "TBA";
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Reads a money amount typed by staff ("3,000", "2500.5"). Null for empty; NaN for nonsense. */
export function parseAmount(v: unknown): number | null {
  const s = String(v ?? "").replace(/[,\s]/g, "");
  if (!s) return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

/** A Google Drive folder link, cleaned; "" if it isn't one. */
export function cleanDriveUrl(v: string): string {
  const raw = v.trim();
  if (!raw) return "";
  const m = /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})(?:[/?#].*)?$/.exec(raw);
  return m ? `https://drive.google.com/drive/folders/${m[1]}` : "";
}
/** Google's embedded folder view (shows files only to people the folder is shared with). */
export function driveEmbedUrl(folderUrl: string): string | null {
  const m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(folderUrl);
  return m ? `https://drive.google.com/embeddedfolderview?id=${m[1]}#list` : null;
}

/** "12 months from 1 Dec 2026" style term line. */
export function termLine(p: { starts_on: string | null; term_months: number | null }): string {
  const start = p.starts_on ? new Date(`${p.starts_on}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  if (p.term_months && start) return `${p.term_months} months from ${start}`;
  if (p.term_months) return `${p.term_months} months`;
  if (start) return `From ${start}`;
  return "TBA";
}

export const billingLabel = (b: string) => (b === "start_of_month" ? "Billed at the start of each month" : "Billed at the end of each month");

/** Splits typed lines into a clean list. */
export const lines = (v: unknown, max = 12, len = 300) =>
  String(v ?? "")
    .split("\n")
    .map((x) => x.trim().slice(0, len))
    .filter(Boolean)
    .slice(0, max);
