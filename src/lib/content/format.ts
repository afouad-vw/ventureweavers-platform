import type { TagTone } from "@/components/ui/tag";
import { formatDate, formatDateTime } from "@/lib/events/format";

export const SPACES: { value: TagTone; label: string }[] = [
  { value: "House", label: "VentureWeavers" },
  { value: "Outloud", label: "Outloud" },
  { value: "TVS", label: "TVS" },
  { value: "BRICKR", label: "BRICKR" },
  { value: "QuidQuo", label: "QuidQuo" },
];
export const isSpace = (v: string): v is TagTone => SPACES.some((s) => s.value === v);

export const CONTENT_FORMATS = ["Short", "Carousel", "Reel", "Episode"] as const;
export const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "YouTube"] as const;
export const SERIES = ["The Question", "In 60 Seconds", "The Answer", "Next Show", "Full episodes"] as const;
export type ContentStatus = "draft" | "scheduled" | "published";
export const CONTENT_STATUSES: { value: ContentStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

export const BLOG_CATEGORIES = ["Newsletter", "Article", "Founder notes"] as const;
export const AUTHORS = ["Fouad & Karim", "Ahmed Fouad", "Karim Hemdan"] as const;

export const LIBRARY_KINDS = ["Report", "Guide", "Template", "AI skill"] as const;
export type AccessLevel = "all_members" | "tvs_learners" | "brickr_clients" | "quidquo_waitlist";
export const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "all_members", label: "All members" },
  { value: "tvs_learners", label: "TVS learners" },
  { value: "brickr_clients", label: "BRICKR clients" },
  { value: "quidquo_waitlist", label: "QuidQuo waitlist" },
];
export const accessLabel = (a: string) => ACCESS_LEVELS.find((x) => x.value === a)?.label ?? a;
/** Levels members can hold today. Learner, client and waitlist levels arrive with Phases 6 and 7. */
export const OPEN_LEVELS: AccessLevel[] = ["all_members"];

/** Library file types: extension → content type. */
export const LIBRARY_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
export const LIBRARY_MAX_BYTES = 20 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** "Pricing, CFO , angels" → ["Pricing", "CFO", "angels"], at most 8, no duplicates. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const t = raw.trim().replace(/\s+/g, " ").slice(0, 30);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
    if (out.length === 8) break;
  }
  return out;
}

/** A link a feed post may carry: a path inside the app or an https address. Mirrors is_safe_link() in the database. */
export function cleanLink(input: string): string | null | "invalid" {
  const v = input.trim();
  if (!v) return null;
  if (v.length > 500) return "invalid";
  if (/^\/(?!\/)[A-Za-z0-9/_?=&.#%-]*$/.test(v)) return v;
  if (/^https:\/\/[^\s<>"]+$/.test(v)) return v;
  return "invalid";
}

export const isExternal = (href: string) => href.startsWith("https://");

/** "Just now", "3 hours ago", "2 days ago", then the date. */
export function relativeWhen(iso: string, now = new Date()) {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  if (d < 14) return "1 week ago";
  if (d < 28) return `${Math.round(d / 7)} weeks ago`;
  return formatDate(iso);
}

/** The feed with the chosen space chip applied. "All" keeps everything. */
export function filterBySpace<T extends { space: string }>(items: T[], space: string): T[] {
  return space === "All" || !isSpace(space) ? items : items.filter((i) => i.space === space);
}

export type ReminderBooking = {
  id: string;
  status: string;
  seats: number;
  hold_expires_at: string | null;
  events: { slug: string; title: string; starts_at: string | null } | null;
};

export type Reminder = { key: string; icon: "ticket" | "wallet"; title: string; detail: string; href: string; cta: string; at: number };

/**
 * Reminders for Home: reservations still to pay (with the deadline) and booked events in the next 7 days.
 * Live sessions, assignments and meetings join this list in later phases.
 */
export function buildReminders(bookings: ReminderBooking[], now = new Date()): Reminder[] {
  const t = now.getTime();
  const week = t + 7 * 24 * 3600 * 1000;
  const out: Reminder[] = [];
  for (const b of bookings) {
    const ev = b.events;
    if (!ev?.starts_at) continue;
    const start = new Date(ev.starts_at).getTime();
    if (start < t) continue;
    if (b.status === "reserved" && b.hold_expires_at) {
      const due = new Date(b.hold_expires_at).getTime();
      if (due <= t) continue;
      out.push({ key: `pay-${b.id}`, icon: "wallet", title: `Pay for ${ev.title}`, detail: `Seats held until ${formatDateTime(b.hold_expires_at)}`, href: "/my-space", cta: "Pay", at: due });
    } else if (b.status === "confirmed" && start <= week) {
      out.push({ key: `ev-${b.id}`, icon: "ticket", title: ev.title, detail: `${formatDateTime(ev.starts_at)} · doors open 30 min before`, href: "/my-space", cta: "Ticket", at: start });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** How complete a profile is, 0–100, from the fields the partners use to prepare. */
export function profileCompletion(p: { full_name?: string | null; avatar_url?: string | null; phone?: string | null; role?: string | null; stage?: string | null; goals?: string[] | null; interests?: string[] | null } | null) {
  if (!p) return 0;
  const parts = [p.full_name, p.avatar_url, p.phone, p.role, p.stage, p.goals?.length ? "y" : "", p.interests?.length ? "y" : ""];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

/** "founder · seed · growth, fundraising, hiring" */
export function tunedTo(p: { role?: string | null; stage?: string | null; interests?: string[] | null } | null) {
  const bits = [p?.role, p?.stage, p?.interests?.slice(0, 3).join(", ")].filter(Boolean).map((s) => String(s).toLowerCase());
  return bits.join(" · ");
}

/** High-resolution YouTube thumbnail for a YouTube link (watch, youtu.be, shorts, embed), or null. */
export function youtubeThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "music.youtube.com") id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : null;
  } catch {
    return null;
  }
}
