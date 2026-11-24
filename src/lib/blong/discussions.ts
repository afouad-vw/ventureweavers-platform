/** BLong discussions (Phase 18c). Shared by server and client; no React or database here. */
import { parseTopics } from "./communities";

export const DISCUSSION_CATEGORIES = ["Fundraising", "Building and growth", "Investing", "Careers and hiring", "Programs and learning", "Events", "Other"] as const;
export type DiscussionCategory = (typeof DISCUSSION_CATEGORIES)[number];

export const ROOM_PRIVACY = [
  { value: "public", label: "Public", note: "Anyone who can see it can read along and join, until the limit is reached." },
  { value: "request", label: "Request to join", note: "People ask; you or your admins accept. Only members read it." },
  { value: "invite", label: "Invite only", note: "Hidden from Explore. Only people you invite find it." },
] as const;
export type RoomPrivacy = (typeof ROOM_PRIVACY)[number]["value"];
export const privacyLabel = (p: RoomPrivacy) => ROOM_PRIVACY.find((x) => x.value === p)?.label ?? p;

export type RoomRole = "owner" | "admin" | "member";
export type RoomMemberStatus = "active" | "requested" | "invited";

export type DiscussionRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: DiscussionCategory;
  tags: string[];
  member_limit: number;
  privacy: RoomPrivacy;
  community_id: string | null;
  community_name: string | null;
  community_slug: string | null;
  status: "open" | "closed" | "archived" | "pending" | "declined";
  members: number;
  last_message_at: string | null;
  my_role: RoomRole | null;
  my_status: RoomMemberStatus | null;
  created_at?: string;
};

export type DiscussionPage = Omit<DiscussionRow, "community_id" | "community_name" | "community_slug" | "last_message_at"> & {
  archived_by_team: boolean;
  created_at: string;
  community: { id: string; name: string; slug: string } | null;
  requests: number;
  owner: { id: string; name: string; avatar_url: string | null } | null;
  pinned: { id: string; body: string; name: string } | null;
  can_read: boolean;
  /** For the people who run it and staff (Phase 19a). */
  review_note?: string | null;
  resubmitted?: boolean;
};

export type RoomMessage = {
  id: string;
  author: string;
  name: string;
  avatar_url: string | null;
  body: string;
  removed: boolean;
  reply_to: string | null;
  reply_name: string | null;
  reply_body: string | null;
  created_at: string;
  /** Phase 19b: held (waiting for review) and hidden (after reports) messages reach only their author. */
  mod_status?: "live" | "held" | "hidden";
  /** Phase 19c engagement. */
  likes?: number;
  liked?: boolean;
  saved?: boolean;
  views?: number;
  replies?: number;
};

export type DiscussionInput = { title: string; description: string; category: DiscussionCategory; tags: string[]; limit: number; privacy: RoomPrivacy; community: string | null };

export const DISCUSSION_LIMITS = { title: 120, description: 1000, minMembers: 2, maxMembers: 500, message: 2000 } as const;

export function parseDiscussion(f: FormData): { ok: true; value: DiscussionInput } | { ok: false; error: string } {
  const title = String(f.get("title") ?? "").trim().replace(/\s+/g, " ");
  const description = String(f.get("description") ?? "").trim();
  const category = String(f.get("category") ?? "") as DiscussionCategory;
  const privacy = String(f.get("privacy") ?? "public") as RoomPrivacy;
  const limit = Number(f.get("limit"));
  const community = String(f.get("community") ?? "").trim() || null;
  if (title.length < 3 || title.length > DISCUSSION_LIMITS.title) return { ok: false, error: "Give the discussion a title of 3 to 120 characters." };
  if (description.length > DISCUSSION_LIMITS.description) return { ok: false, error: "Keep the description to 1,000 characters." };
  if (!(DISCUSSION_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: "Choose a category." };
  if (!ROOM_PRIVACY.some((p) => p.value === privacy)) return { ok: false, error: "Choose who can join." };
  if (!Number.isInteger(limit) || limit < DISCUSSION_LIMITS.minMembers || limit > DISCUSSION_LIMITS.maxMembers) return { ok: false, error: "The member limit is 2 to 500 people." };
  return { ok: true, value: { title, description, category, tags: parseTopics(String(f.get("tags") ?? "")), limit, privacy, community } };
}

export const DISCUSSION_TABS = [
  { value: "explore", label: "Explore" },
  { value: "joined", label: "Joined" },
  { value: "owned", label: "Owned" },
] as const;
export type DiscussionTab = (typeof DISCUSSION_TABS)[number]["value"];
export const isDiscussionTab = (v: unknown): v is DiscussionTab => DISCUSSION_TABS.some((t) => t.value === v);

export function discussionCta(d: Pick<DiscussionRow, "privacy" | "my_role" | "my_status" | "members" | "member_limit" | "status">): string {
  if (d.status === "pending" || d.status === "declined") return "Open";
  if (d.my_status === "invited") return "Accept invite";
  if (d.my_status === "requested") return "Requested";
  if (d.my_status === "active") return "Open";
  if (d.status !== "open") return "Read";
  if (d.privacy === "public") return d.members >= d.member_limit ? "Read (full)" : "Join";
  return "Ask to join";
}

/** "12 min ago", "2 h ago", "Yesterday", "3 Nov". */
export function activeAgo(iso: string | null, now = new Date()): string {
  if (!iso) return "No messages yet";
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (mins < 1) return "Active now";
  if (mins < 60) return `Active ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Active ${hours} h ago`;
  if (hours < 48) return "Active yesterday";
  return `Active ${new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(d)}`;
}

export function discussionError(message: string): string {
  if (message.includes("mod_blocked_word")) return "That message includes words the community doesn't allow. Please rephrase it.";
  if (message.includes("mod_blocked_link")) return "Links to that site aren't allowed.";
  if (message.includes("mod_too_many_links")) return "That's a lot of links for one message. Please share fewer.";
  if (message.includes("mod_new_member_links")) return "New members can share links after their first week.";
  if (message.includes("mod_new_member")) return "New members can do this after their first few days. Meanwhile, join discussions and follow people.";
  if (message.includes("mod_duplicate")) return "You just sent that. Try saying something new.";
  if (message.includes("mod_slow_down")) return "You're sending messages quickly. Please wait a moment.";
  if (message.includes("section_off")) return "Discussions are coming soon. Press Notify me and we'll tell you when they open.";
  if (message.includes("pending_review")) return "This discussion is waiting for the team's approval.";
  if (message.includes("too_many_discussions")) return "You've started 10 discussions today. Please try again tomorrow.";
  if (message.includes("too_many_messages")) return "You've sent a lot of messages in the last hour. Please wait a little.";
  if (message.includes("too_many_invites")) return "You've sent a lot of invites in the last hour. Please wait a little.";
  if (message.includes("room_full")) return "This discussion is full.";
  if (message.includes("room_closed")) return "This discussion is closed. You can still read it.";
  if (message.includes("invite_only")) return "This discussion is invite only.";
  if (message.includes("not_in_community")) return "Only members of the community can do that.";
  if (message.includes("not_a_room_member")) return "Join the discussion to post.";
  if (message.includes("limit_below_members")) return "The limit can't be lower than the number of people already in.";
  if (message.includes("owner_must_transfer")) return "Hand the discussion to another member before leaving, or delete it.";
  if (message.includes("archived_by_team")) return "The VentureWeavers team archived this discussion. Message the team to restore it.";
  if (message.includes("not_allowed")) return "Only the discussion's owner or admins can do that.";
  if (message.includes("bad_message")) return "Write a message (up to 2,000 characters).";
  if (message.includes("not_found")) return "This discussion isn't available.";
  if (message.includes("_check")) return "Please check the details and try again.";
  return "Something went wrong. Please try again.";
}
