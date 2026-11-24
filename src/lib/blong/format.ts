/** BLong, the community space (Phase 18). Shared by server and client; no React or database here so it stays testable. */

export const BLONG_COLOUR = "#7C5CE0";
export const BLONG_TINT = "#B4A2F5";

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
  if (message.includes("too_many_follows")) return "You've followed a lot of people in the last hour. Please try again later.";
  if (message.includes("too_many_messages")) return "You've sent a lot of messages in the last hour. Please wait a little.";
  if (message.includes("too_many_reports")) return "You've sent several reports today. The team will look at them soon.";
  if (message.includes("cannot_message")) return "You can message this member once they accept your follow request.";
  if (message.includes("bad_message")) return "Write a message (up to 2,000 characters).";
  if (message.includes("not_a_member")) return "Your account can't do this.";
  if (message.includes("not_found")) return "This member isn't available.";
  return "Something went wrong. Please try again.";
}

export type Activity = { kind: "events" | "programs" | "communities" | "posts"; verb: string; title: string; href: string; at: string; starts_at: string | null };
export type FeedItem = Activity & { member_id: string; name: string; avatar_url: string | null };

export const ACTIVITY_LABEL: Record<Activity["kind"], string> = { events: "Event", programs: "Program", communities: "BLong", posts: "News" };

/** "Today", "Yesterday", "3 Nov", in Cairo time. */
export function activityDay(iso: string, now = new Date()): string {
  const f = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);
  const day = f(new Date(iso));
  if (day === f(now)) return "Today";
  if (day === f(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(new Date(iso));
}
