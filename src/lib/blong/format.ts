/** BLong, the community space (Phase 18). Shared by server and client; no React or database here so it stays testable. */

export const BLONG_COLOUR = "#7C5CE0";
export const BLONG_TINT = "#B4A2F5";

/** Communities and Discussions can be switched off by the team (Coming soon + Notify me). Ids of their Notify me lists. */
export type BlongSection = "communities" | "discussions";
export const BLONG_SECTION_IDS: Record<BlongSection, string> = {
  communities: "00000000-0000-0000-0000-00000000b101",
  discussions: "00000000-0000-0000-0000-00000000b102",
};
export const BLONG_SECTION_TITLE: Record<BlongSection, string> = { communities: "BLong communities", discussions: "BLong discussions" };
export type BlongSections = Record<BlongSection, boolean>;

export type Visibility = "public" | "private";
export type FollowState = "none" | "requested" | "following";

export type MemberLite = {
  id: string;
  name: string;
  avatar_url: string | null;
  roles: string[];
  visibility: Visibility;
  follow_state: FollowState;
  follows_me: boolean;
  country?: string | null;
  business?: string | null;
  since?: string | null;
};

export type MemberCard = MemberLite & {
  self: boolean;
  open: boolean;
  can_message: boolean;
  followers: number;
  following: number;
  bio: string | null;
  linkedin: string | null;
  links: { label: string; url: string }[];
  businesses: { name: string; type: string | null; website: string | null; role: string | null }[];
};

export type DmThread = {
  id: string;
  other_id: string;
  name: string;
  avatar_url: string | null;
  last_body: string | null;
  last_mine: boolean;
  last_message_at: string;
  unread: number;
  can_send: boolean;
};

export type DmMessage = { id: string; author: string; body: string; created_at: string };

export const ACTIVITY_KINDS = [
  { key: "events", label: "Shows and events I attend" },
  { key: "programs", label: "Programs and masterclasses I join" },
  { key: "communities", label: "Communities and discussions I join" },
  { key: "posts", label: "News and posts I publish" },
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["key"];

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or selling" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "privacy", label: "Sharing private details" },
  { value: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const isReportReason = (v: unknown): v is ReportReason => REPORT_REASONS.some((r) => r.value === v);

/** The follow button's words for a member, from where you stand. */
export function followLabel(state: FollowState, visibility: Visibility, followsMe = false): string {
  if (state === "following") return "Following";
  if (state === "requested") return "Requested";
  if (visibility === "private") return followsMe ? "Ask to follow back" : "Ask to follow";
  return followsMe ? "Follow back" : "Follow";
}

export const BIO_MAX = 300;
export const LINKS_MAX = 5;

/** Trims a bio; null when empty. Throws nothing: overlong text is cut, the form shows the limit. */
export function cleanBio(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, BIO_MAX);
  return s || null;
}

/** Keeps up to 5 links with a label and an https address (adds https:// when missing). */
export function cleanLinks(raw: { label?: unknown; url?: unknown }[]): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const r of raw) {
    const label = String(r.label ?? "").trim().slice(0, 40);
    let url = String(r.url ?? "").trim();
    if (!label && !url) continue;
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    url = url.replace(/^http:\/\//i, "https://");
    if (!label || url.length > 200 || !/^https:\/\/[^\s<>"]+\.[^\s<>"]+$/.test(url)) throw new Error(`"${label || url}" needs a name and a full web address.`);
    out.push({ label, url });
    if (out.length > LINKS_MAX) throw new Error(`Up to ${LINKS_MAX} links.`);
  }
  return out;
}

export const NETWORK_TABS = [
  { value: "members", label: "Members" },
  { value: "feed", label: "Feed" },
  { value: "following", label: "Following" },
  { value: "followers", label: "Followers" },
  { value: "requests", label: "Requests" },
] as const;
export type NetworkTab = (typeof NETWORK_TABS)[number]["value"];
export const isNetworkTab = (v: unknown): v is NetworkTab => NETWORK_TABS.some((t) => t.value === v);

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** A short line under a member's name: roles, then business, then country. */
export function memberLine(m: Pick<MemberLite, "roles" | "business" | "country">): string {
  return [m.roles.slice(0, 2).join(", "), m.business, m.country].filter(Boolean).join(" · ");
}

/** Friendly errors for the database's codes. */
export function blongError(message: string): string {
  if (message.includes("mod_blocked_word")) return "That message includes words the community doesn't allow. Please rephrase it.";
  if (message.includes("mod_blocked_link")) return "Links to that site aren't allowed.";
  if (message.includes("mod_too_many_links")) return "That's a lot of links for one message. Please share fewer.";
  if (message.includes("mod_new_member_links")) return "New members can share links after their first week.";
  if (message.includes("mod_new_member")) return "New members can do this after their first few days. Meanwhile, join discussions and follow people.";
  if (message.includes("mod_duplicate")) return "You just sent that. Try saying something new.";
  if (message.includes("mod_slow_down")) return "You're sending messages quickly. Please wait a moment.";
  if (message.includes("too_many_follows")) return "You've followed a lot of people in the last hour. Please try again later.";
  if (message.includes("too_many_messages")) return "You've sent a lot of messages in the last hour. Please wait a little.";
  if (message.includes("too_many_reports")) return "You've sent several reports today. The team will look at them soon.";
  if (message.includes("cannot_message")) return "You can message this member once they accept your follow request.";
  if (message.includes("bad_message")) return "Write a message (up to 2,000 characters).";
  if (message.includes("not_a_member")) return "Your account can't do this.";
  if (message.includes("not_found")) return "This member isn't available.";
  return "Something went wrong. Please try again.";
}

export type Activity = { kind: "events" | "programs" | "communities" | "posts" | "post"; verb: string; title: string; href: string; at: string; starts_at: string | null };
export type FeedItem = Activity & { member_id: string; name: string; avatar_url: string | null };

export const ACTIVITY_LABEL: Record<Activity["kind"], string> = { events: "Event", programs: "Program", communities: "BLong", posts: "News", post: "Post" };

/** "Today", "Yesterday", "3 Nov", in Cairo time. */
export function activityDay(iso: string, now = new Date()): string {
  const f = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);
  const day = f(new Date(iso));
  if (day === f(now)) return "Today";
  if (day === f(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(new Date(iso));
}

/** The chip for an item waiting for (or refused) approval; null when it's live. */
export function reviewChip(status: string): { label: string; tone: "warn" | "bad" } | null {
  if (status === "pending") return { label: "Waiting for approval", tone: "warn" };
  if (status === "declined") return { label: "Not approved", tone: "bad" };
  return null;
}

/** Why the rules held something, for the team's Held queue. */
export const MOD_RULE_LABEL: Record<string, string> = {
  blocked_word: "Blocked word",
  new_member_link: "Link from a new member",
  new_member: "New member's first messages",
  reports: "Hidden after reports",
};

export type ModerationRules = {
  blocked_words: string[]; blocked_action: "hold" | "reject"; blocked_domains: string[]; max_links: number; link_new_days: number;
  per_minute: number; new_member_days: number; new_member_hold: number; auto_hide_reports: number;
};

const LIMITS: Record<Exclude<keyof ModerationRules, "blocked_words" | "blocked_action" | "blocked_domains">, [number, number]> = {
  max_links: [0, 20], link_new_days: [0, 90], per_minute: [1, 60], new_member_days: [0, 90], new_member_hold: [0, 20], auto_hide_reports: [1, 50],
};

/** Reads the moderation form: lists one per line or comma-separated, numbers within their ranges. */
export function parseRules(f: FormData): { ok: true; value: ModerationRules } | { ok: false; error: string } {
  const list = (k: string, max: number, len: number) =>
    [...new Set(String(f.get(k) ?? "").split(/[\n,،]/).map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, max).map((x) => x.slice(0, len));
  const blocked_words = list("blocked_words", 500, 40);
  const blocked_domains = list("blocked_domains", 200, 100).map((d) => d.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, ""));
  const blocked_action = f.get("blocked_action") === "reject" ? "reject" : "hold";
  const nums = {} as Record<keyof typeof LIMITS, number>;
  for (const [k, [lo, hi]] of Object.entries(LIMITS) as [keyof typeof LIMITS, [number, number]][]) {
    const v = Number(f.get(k));
    if (!Number.isInteger(v) || v < lo || v > hi) return { ok: false, error: `Check the numbers: ${k.replace(/_/g, " ")} is ${lo} to ${hi}.` };
    nums[k] = v;
  }
  return { ok: true, value: { blocked_words, blocked_action, blocked_domains, ...nums } };
}
