/** Coming soon, waitlists and how members meet us: pure helpers shared by member and admin screens. */
import { cleanCalendlyUrl } from "@/lib/calendly-url";

export type WaitItemType = "service" | "program" | "event" | "blong_section";
export const WAIT_TYPES: readonly WaitItemType[] = ["service", "program", "event", "blong_section"];
export const isWaitType = (v: unknown): v is WaitItemType => typeof v === "string" && (WAIT_TYPES as readonly string[]).includes(v);
export const waitKey = (type: WaitItemType, id: string) => `${type}:${id}`;

/** Draft / Coming soon / Published, for services and events. */
export type PubStatus = "draft" | "coming_soon" | "published";
export const PUB_STATUS_OPTIONS: { value: PubStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "published", label: "Published" },
];
export const parsePubStatus = (v: unknown): PubStatus => (v === "published" || v === "coming_soon" ? v : "draft");

/** A label and pill tone for any item status (programs also have Open and Closed). */
export function statusLabel(s: string): string {
  return s === "coming_soon" ? "Coming soon" : s === "published" ? "Published" : s === "open" ? "Open" : s === "closed" ? "Closed" : "Draft";
}
export function statusTone(s: string): "ok" | "blue" | "warn" | "draft" {
  return s === "published" || s === "open" ? "ok" : s === "coming_soon" ? "blue" : s === "closed" ? "warn" : "draft";
}
/** Visible to members (live or coming soon). */
export const isListed = (s: string) => s === "published" || s === "open" || s === "coming_soon";

/** How members meet us for a service. */
export type BookingMode = "request" | "calendar" | "both";
export const BOOKING_OPTIONS: { value: BookingMode; label: string }[] = [
  { value: "request", label: "Meeting request (member picks a preferred time)" },
  { value: "calendar", label: "Book from the calendar (Calendly)" },
  { value: "both", label: "Both: member chooses" },
];

/** Reads the booking fields from the service editor. Calendar and Both need a Calendly scheduling link. */
export function parseBooking(mode: unknown, url: unknown): { ok: true; booking: BookingMode; calendly_url: string | null } | { ok: false; error: string } {
  const booking: BookingMode = mode === "calendar" || mode === "both" ? mode : "request";
  const raw = String(url ?? "").trim();
  const clean = cleanCalendlyUrl(raw);
  if (raw && !clean) return { ok: false, error: "That isn't a Calendly scheduling link. It looks like calendly.com/your-name/event." };
  if (booking !== "request" && !clean) return { ok: false, error: "Add the Calendly link members book from." };
  return { ok: true, booking, calendly_url: clean || null };
}

/** Which buttons a service shows: Notify me while Coming soon, otherwise its booking setting. */
export function meetingButtons(s: { status: string; booking?: BookingMode | null; calendly_url?: string | null }): ("notify" | "calendar" | "request")[] {
  if (s.status === "coming_soon") return ["notify"];
  const url = s.calendly_url ? cleanCalendlyUrl(s.calendly_url) : "";
  if (url && s.booking === "calendar") return ["calendar"];
  if (url && s.booking === "both") return ["calendar", "request"];
  return ["request"];
}

/** Where a member opens an item that just went live. */
export function waitItemHref(type: WaitItemType, x: { slug: string; space?: string | null; type?: string | null }): string {
  if (type === "program") return `/tvs/programs/${x.slug}`;
  if (type === "blong_section") return `/blong/${x.slug}`;
  if (type === "event") return x.type === "masterclass" ? `/tvs/masterclasses/${x.slug}` : `/outloud/events/${x.slug}`;
  return x.space === "TVS" ? "/tvs" : x.space === "Outloud" ? "/outloud" : `/brickr/services/${x.slug}`;
}

export type WaitPerson = { member_id: string; name: string; email: string | null; at: string; notified: boolean };

/** A waitlist as CSV (names, emails, when they joined, whether they were told). */
export function waitlistCsv(title: string, people: WaitPerson[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${v.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : v);
  const rows = [["Item", "Name", "Email", "Joined", "Notified"], ...people.map((p) => [title, p.name, p.email ?? "", p.at.slice(0, 10), p.notified ? "Yes" : "No"])];
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
