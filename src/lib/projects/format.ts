/** BRICKR client projects (Phase 17): labels and rules shared by member and admin screens. */

export type ProjectKind = "portfolio" | "venture";
export type ProjectStatus = "proposal" | "pending_approval" | "approved" | "onboarding" | "active" | "paused" | "renewal" | "completed" | "cancelled";
export type RequestCategory = "extra_work" | "scope_change" | "meeting" | "question" | "document" | "other";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type MilestoneStatus = "planned" | "in_progress" | "done";
export type Health = "green" | "amber" | "red";
export type Currency = "EGP" | "USD";
export type ProjectRole = "lead" | "team";
export type RequestStatus = "submitted" | "in_review" | "quoted" | "approved" | "client_declined" | "declined" | "in_progress" | "done" | "cancelled";
export type MeetingKind = "kickoff" | "weekly" | "review" | "checkin" | "other";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; hint: string }[] = [
  { value: "proposal", label: "Proposal", hint: "Proposal being prepared" },
  { value: "pending_approval", label: "Pending approval", hint: "Moves here when the proposal is uploaded" },
  { value: "approved", label: "Approved", hint: "Moves here when the client lead accepts" },
  { value: "onboarding", label: "Situation assessment", hint: "Moves here on the start date (Month 1)" },
  { value: "active", label: "Active", hint: "Moves here one month after the start" },
  { value: "renewal", label: "Renewal due", hint: "Moves here one month before the term ends" },
  { value: "paused", label: "Paused", hint: "Set by partners" },
  { value: "completed", label: "Completed", hint: "Set by partners" },
  { value: "cancelled", label: "Cancelled", hint: "Set by partners" },
];
/** The usual path, shown as a progress line. */
export const STATUS_PATH: ProjectStatus[] = ["proposal", "pending_approval", "approved", "onboarding", "active", "renewal", "completed"];
export const projectStatusLabel = (s: string) => PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s;
export const projectStatusTone = (s: string): "ok" | "blue" | "warn" | "draft" =>
  s === "active" || s === "approved" || s === "onboarding" ? "ok" : s === "proposal" || s === "pending_approval" ? "blue" : s === "paused" || s === "renewal" ? "warn" : "draft";
/** Projects the client works in day to day (plan, requests and meetings open). */
export const isLiveProject = (s: string) => ["approved", "onboarding", "active", "renewal"].includes(s);

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

export const REQUEST_CATEGORIES: { value: RequestCategory; label: string; hint: string; priced: boolean }[] = [
  { value: "extra_work", label: "Extra work", hint: "Work beyond the agreed scope. We quote it; you approve.", priced: true },
  { value: "scope_change", label: "Scope change", hint: "Change what the retainer covers. We quote it; you approve.", priced: true },
  { value: "meeting", label: "Meeting or call", hint: "Ask for a session outside the weekly rhythm.", priced: false },
  { value: "question", label: "Question or advice", hint: "A quick question for the partners.", priced: false },
  { value: "document", label: "Document or data", hint: "Ask for, or send, a document or data.", priced: false },
  { value: "other", label: "Other", hint: "Anything else.", priced: false },
];
export const categoryOf = (c: string) => REQUEST_CATEGORIES.find((x) => x.value === c) ?? REQUEST_CATEGORIES[0];
export const isPricedCategory = (c: string) => categoryOf(c).priced;

/**
 * The next steps staff can take on a request. Approval is the client lead's; paid work can only start once approved.
 * Meetings, questions, documents and other requests are not quoted: they are answered and closed.
 */
export function staffRequestMoves(r: { status: string; price: number | null; category?: string }): RequestStatus[] {
  if (r.category && !isPricedCategory(r.category)) {
    switch (r.status) {
      case "submitted":
        return ["in_review", "in_progress", "done", "declined"];
      case "in_review":
        return ["in_progress", "done", "declined"];
      case "in_progress":
        return ["done", "cancelled"];
      default:
        return [];
    }
  }
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

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];
export const taskStatusLabel = (s: string) => TASK_STATUSES.find((x) => x.value === s)?.label ?? s;
export const taskTone = (s: string): "ok" | "blue" | "warn" | "draft" => (s === "done" ? "ok" : s === "in_progress" ? "blue" : s === "blocked" ? "warn" : "draft");
export const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];
export const milestoneStatusLabel = (s: string) => MILESTONE_STATUSES.find((x) => x.value === s)?.label ?? s;
export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;

/** Share of done tasks, 0–100 (null when there are none). */
export function progressOf(tasks: { status: string }[]): number | null {
  if (!tasks.length) return null;
  return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
}

/** A task is overdue when it has a due date before today (Cairo) and isn't done. */
export function isOverdue(t: { status: string; due_on: string | null }, today: string): boolean {
  return !!t.due_on && t.status !== "done" && t.due_on < today;
}

/** Today's date in Cairo, YYYY-MM-DD. */
export const cairoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

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
/** Any https folder link (Drive, SharePoint, Dropbox…), Drive links cleaned; "" if empty, null if not a safe link. */
export function cleanFolderUrl(v: string): string | null {
  const raw = v.trim();
  if (!raw) return "";
  const drive = cleanDriveUrl(raw);
  if (drive) return drive;
  if (raw.length > 300 || !/^https:\/\/[^\s<>"]+$/.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}
/** Google's embedded folder view (shows files only to people the folder is shared with). */
export function driveEmbedUrl(folderUrl: string): string | null {
  const clean = cleanDriveUrl(folderUrl);
  const m = clean ? /\/folders\/([A-Za-z0-9_-]{10,})/.exec(clean) : null;
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
