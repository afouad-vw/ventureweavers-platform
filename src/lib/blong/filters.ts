/** BLong filters and sorting (Phase 19d). Pure functions over list rows; the URL holds the choices so filtered lists can be shared. */
import type { CommunityRow } from "./communities";
import type { DiscussionRow } from "./discussions";
import type { Activity, FeedItem } from "./format";

export type Option = { value: string; label: string };
type Params = Record<string, string | string[] | undefined>;

/** A query value, only when it's one of the allowed ones. */
export function pick(params: Params, key: string, allowed: readonly string[]): string {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && allowed.includes(s) ? s : "";
}

/** A free-text value (tags, topics), trimmed and lower-cased, at most 40 characters. */
export function pickText(params: Params, key: string): string {
  const v = params[key];
  return String((Array.isArray(v) ? v[0] : v) ?? "").trim().toLowerCase().slice(0, 40);
}

export const opts = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v }));

// ---------------------------------------------------------------- communities

export const COMMUNITY_SIZES: Option[] = [
  { value: "small", label: "Under 50 members" },
  { value: "medium", label: "50 to 200 members" },
  { value: "large", label: "200+ members" },
];
export const COMMUNITY_SORTS: Option[] = [
  { value: "members", label: "Most members" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A to Z" },
];
export const VISIBILITY_OPTS: Option[] = [{ value: "public", label: "Public" }, { value: "private", label: "Private" }];

export type CommunityFilters = { topic: string; audience: string; visibility: string; size: string; sort: string };

const inSize = (n: number, size: string) => (size === "small" ? n < 50 : size === "medium" ? n >= 50 && n <= 200 : size === "large" ? n > 200 : true);

export function filterCommunities(list: CommunityRow[], f: CommunityFilters): CommunityRow[] {
  const out = list.filter((c) =>
    (!f.topic || c.topics.some((t) => t.toLowerCase().includes(f.topic))) &&
    (!f.audience || c.audience.length === 0 || c.audience.includes(f.audience)) &&
    (!f.visibility || c.visibility === f.visibility) &&
    inSize(c.members, f.size));
  if (f.sort === "newest") return out.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  if (f.sort === "name") return out.sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === "members") return out.sort((a, b) => b.members - a.members);
  return out;
}

/** Topics used across the list, most used first, for the topic choices. */
export function topTopics(list: CommunityRow[], max = 20): string[] {
  const n = new Map<string, number>();
  for (const c of list) for (const t of c.topics) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([t]) => t);
}

// ---------------------------------------------------------------- discussions

export const ROOM_JOIN_OPTS: Option[] = [
  { value: "public", label: "Public" },
  { value: "request", label: "Request to join" },
  { value: "invite", label: "Invite only" },
];
export const ROOM_STATUS_OPTS: Option[] = [{ value: "open", label: "Open" }, { value: "closed", label: "Closed (read only)" }];
export const DISCUSSION_SORTS: Option[] = [
  { value: "active", label: "Active now" },
  { value: "newest", label: "Newest" },
  { value: "members", label: "Most members" },
];

export type DiscussionFilters = { community: string; privacy: string; status: string; room: boolean; tag: string; sort: string };

export function filterDiscussions(list: DiscussionRow[], f: DiscussionFilters): DiscussionRow[] {
  const out = list.filter((d) =>
    (!f.community || (f.community === "none" ? !d.community_id : d.community_id === f.community)) &&
    (!f.privacy || d.privacy === f.privacy) &&
    (!f.status || d.status === f.status) &&
    (!f.room || (d.status === "open" && d.members < d.member_limit)) &&
    (!f.tag || d.tags.some((t) => t.toLowerCase().includes(f.tag))));
  if (f.sort === "newest") return out.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  if (f.sort === "members") return out.sort((a, b) => b.members - a.members);
  if (f.sort === "active") return out.sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  return out;
}

/** The communities rooms in the list belong to, for the community choices. */
export function roomCommunities(list: DiscussionRow[]): Option[] {
  const seen = new Map<string, string>();
  for (const d of list) if (d.community_id && d.community_name) seen.set(d.community_id, d.community_name);
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
}

// ---------------------------------------------------------------- members and feed

export const MEMBER_SORTS: Option[] = [{ value: "name", label: "Name A to Z" }, { value: "newest", label: "Newest members" }];

export const FEED_KINDS: Option[] = [
  { value: "events", label: "Events" },
  { value: "programs", label: "Programs" },
  { value: "communities", label: "BLong" },
  { value: "posts", label: "News" },
  { value: "post", label: "Posts" },
];

export function filterFeed<T extends Pick<Activity, "kind"> & Partial<FeedItem>>(items: T[], kind: string): T[] {
  return kind ? items.filter((i) => i.kind === kind) : items;
}

/** How many filters are set (for the "Filters (2)" label). */
export const activeCount = (values: (string | boolean)[]) => values.filter(Boolean).length;
