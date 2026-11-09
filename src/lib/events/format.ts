/** Pure helpers for events: money, Cairo dates, slugs, labels. No I/O, unit tested. */

export const TZ = "Africa/Cairo";
export const MAX_SEATS = 2;

export type EventType = "public_show" | "workshop" | "private_session";
export type BookingStatus = "reserved" | "confirmed" | "cancelled" | "expired" | "refunded";

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "public_show", label: "Public show" },
  { value: "workshop", label: "Workshop" },
  { value: "private_session", label: "Private session" },
];
export const typeLabel = (t: EventType) => EVENT_TYPES.find((x) => x.value === t)?.label ?? t;

/** Money is stored in piasters. null means the price isn't set yet. */
export function formatEGP(piasters: number | null | undefined) {
  if (piasters == null) return "[PRICE]";
  const egp = piasters / 100;
  return `EGP ${egp.toLocaleString("en-US", { minimumFractionDigits: piasters % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "450" or "450.50" → 45050. Empty → null. Throws on anything else. */
export function toPiasters(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (s === "") return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) throw new Error("Enter a price like 450 or 450.50");
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;
/** YYYY-MM-DD in Cairo, for date tiles. */
export const cairoDay = (iso: string) => dayFmt.format(new Date(iso));

/** Offset of Cairo from UTC in minutes at a given instant (Egypt has summer time). */
export function cairoOffsetMinutes(at: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+02:00";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "2026-11-20T19:00" typed in Cairo time → UTC ISO string. */
export function cairoLocalToISO(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) throw new Error("Enter a date and time");
  const asUTC = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = asUTC - cairoOffsetMinutes(new Date(asUTC)) * 60_000;
  t = asUTC - cairoOffsetMinutes(new Date(t)) * 60_000; // settle around clock changes
  return new Date(t).toISOString();
}

/** UTC ISO → "2026-11-20T19:00" in Cairo, for datetime-local inputs. */
export function isoToCairoLocal(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + cairoOffsetMinutes(d) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "") || "event";
}

/** Member-facing words for booking errors raised by the database. */
export function bookingError(message: string) {
  const known: Record<string, string> = {
    sold_out: "Sorry, there aren't enough seats left.",
    already_booked: "You already have a booking for this event. It's in My space.",
    seat_limit: `You can book up to ${MAX_SEATS} seats.`,
    not_open: "Booking for this event isn't open yet.",
    event_started: "This event has already started.",
    request_only: "Private sessions are arranged by request.",
    not_found: "This event isn't available.",
    not_signed_in: "Please sign in to book.",
    not_cancellable: "This booking can't be cancelled here. Contact us and we'll help.",
  };
  const key = Object.keys(known).find((k) => message.includes(k));
  return key ? known[key] : "Something went wrong. Please try again.";
}

export type BookingView = { status: BookingStatus; hold_expires_at: string | null; checked_in_at?: string | null };

/** Label and pill tone for a booking as the member sees it. */
export function bookingBadge(b: BookingView, now = new Date()): { label: string; tone: "ok" | "warn" | "blue" | "draft" | "bad" } {
  if (b.checked_in_at) return { label: "Checked in", tone: "ok" };
  if (b.status === "reserved" && b.hold_expires_at && new Date(b.hold_expires_at) <= now) return { label: "Expired", tone: "draft" };
  switch (b.status) {
    case "reserved":
      return { label: "Awaiting payment", tone: "warn" };
    case "confirmed":
      return { label: "Confirmed", tone: "blue" };
    case "refunded":
      return { label: "Refunded", tone: "draft" };
    case "cancelled":
      return { label: "Cancelled", tone: "draft" };
    default:
      return { label: "Expired", tone: "draft" };
  }
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file for one event. Events run 2 hours unless told otherwise. */
export function eventIcs(e: { id: string; title: string; starts_at: string; venue?: string | null; description?: string | null; url?: string }, hours = 2) {
  const start = new Date(e.starts_at);
  const end = new Date(start.getTime() + hours * 3_600_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VentureWeavers//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@ventureweavers.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.venue ? `LOCATION:${icsEscape(e.venue)}` : "",
    e.description ? `DESCRIPTION:${icsEscape(e.description.slice(0, 900))}` : "",
    e.url ? `URL:${e.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter((l) => l !== "")
    .join("\r\n");
}
