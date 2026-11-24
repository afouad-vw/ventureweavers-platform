/** BLong communities (Phase 18b). Shared by server and client; no React or database here. */
import { ROLES } from "@/lib/profile/options";

export const COMMUNITY_TYPES = ["Interest", "Industry or sector", "Role", "Location", "Program alumni", "Other"] as const;
export type CommunityType = (typeof COMMUNITY_TYPES)[number];

export type CommunityRole = "owner" | "admin" | "member";
export type CommunityStatus = "active" | "requested" | "invited";

export type CommunityRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: CommunityType;
  topics: string[];
  audience: string[];
  visibility: "public" | "private";
  cover_url: string | null;
  status: "active" | "archived" | "pending" | "declined";
  members: number;
  my_role: CommunityRole | null;
  my_status: CommunityStatus | null;
};

export type CommunityPage = Omit<CommunityRow, "my_role" | "my_status"> & {
  archived_by_team: boolean;
  created_at: string;
  requests: number;
  owner: { id: string; name: string; avatar_url: string | null } | null;
  my_role: CommunityRole | null;
  my_status: CommunityStatus | null;
  can_see_inside: boolean;
  /** For the people who run it and staff (Phase 19a). */
  review_note?: string | null;
  resubmitted?: boolean;
  /** Who can post on the wall (Phase 19c). */
  posting?: "members" | "admins";
};

export type CommunityPerson = { id: string; name: string; avatar_url: string | null; roles: string[]; role: CommunityRole; status: CommunityStatus; since: string };

export const COMMUNITY_LIMITS = { name: 80, description: 1000, topics: 8, topic: 30 } as const;

export type CommunityInput = {
  name: string;
  description: string;
  type: CommunityType;
  topics: string[];
  audience: string[];
  visibility: "public" | "private";
  cover: string | null;
};

/** Splits "Fundraising, Hiring" into topics: trimmed, 1-30 characters, no repeats, up to 8. */
export function parseTopics(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw.split(/[,\n]/)) {
    const v = t.trim().replace(/\s+/g, " ").slice(0, COMMUNITY_LIMITS.topic);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out.slice(0, COMMUNITY_LIMITS.topics);
}

/** Checks a create or edit form. */
export function parseCommunity(f: FormData, isCover: (url: string) => boolean): { ok: true; value: CommunityInput } | { ok: false; error: string } {
  const name = String(f.get("name") ?? "").trim().replace(/\s+/g, " ");
  const description = String(f.get("description") ?? "").trim();
  const type = String(f.get("type") ?? "") as CommunityType;
  const visibility = f.get("visibility") === "private" ? "private" : "public";
  const audience = f.getAll("audience").map(String).filter((r) => (ROLES as readonly string[]).includes(r));
  const cover = String(f.get("cover") ?? "").trim() || null;
  if (name.length < 3 || name.length > COMMUNITY_LIMITS.name) return { ok: false, error: "Give the community a name of 3 to 80 characters." };
  if (!description || description.length > COMMUNITY_LIMITS.description) return { ok: false, error: "Add a description (up to 1,000 characters)." };
  if (!(COMMUNITY_TYPES as readonly string[]).includes(type)) return { ok: false, error: "Choose a type." };
  if (cover && !isCover(cover)) return { ok: false, error: "Upload the cover image again." };
  return { ok: true, value: { name, description, type, topics: parseTopics(String(f.get("topics") ?? "")), audience, visibility, cover } };
}

export const COMMUNITY_TABS = [
  { value: "explore", label: "Explore" },
  { value: "joined", label: "Joined" },
  { value: "owned", label: "Owned" },
] as const;
export type CommunityTab = (typeof COMMUNITY_TABS)[number]["value"];
export const isCommunityTab = (v: unknown): v is CommunityTab => COMMUNITY_TABS.some((t) => t.value === v);

/** The call to action on a community card, from the viewer's place in it. */
export function communityCta(c: Pick<CommunityRow, "visibility" | "my_role" | "my_status">): string {
  if (c.my_status === "invited") return "Accept invite";
  if (c.my_status === "requested") return "Requested";
  if (c.my_status === "active") return c.my_role === "member" ? "Open" : "Manage";
  return c.visibility === "private" ? "Ask to join" : "View";
}

export const roleLabel = (r: CommunityRole) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member");

export function communityError(message: string): string {
  if (message.includes("too_many_posts")) return "You've posted 20 times today. Please try again tomorrow.";
  if (message.includes("too_many_comments")) return "You've commented a lot in the last hour. Please wait a little.";
  if (message.includes("too_many_likes")) return "That's a lot of likes in an hour. Please wait a little.";
  if (message.includes("too_many_bookmarks")) return "You've saved 1,000 items. Remove some to save more.";
  if (message.includes("admins_only")) return "Only the community's owner and admins post here.";
  if (message.includes("comments_closed")) return "Comments are closed on this post.";
  if (message.includes("not_in_community")) return "Join the community to post and comment.";
  if (message.includes("bad_post")) return "Write a post (up to 3,000 characters).";
  if (message.includes("bad_comment")) return "Write a comment (up to 1,000 characters).";
  if (message.includes("bad_image")) return "Upload the image again.";
  if (message.includes("link_url_check")) return "Links need a full https:// address.";
  if (message.includes("mod_blocked_word")) return "That message includes words the community doesn't allow. Please rephrase it.";
  if (message.includes("mod_blocked_link")) return "Links to that site aren't allowed.";
  if (message.includes("mod_too_many_links")) return "That's a lot of links for one message. Please share fewer.";
  if (message.includes("mod_new_member_links")) return "New members can share links after their first week.";
  if (message.includes("mod_new_member")) return "New members can do this after their first few days. Meanwhile, join discussions and follow people.";
  if (message.includes("mod_duplicate")) return "You just sent that. Try saying something new.";
  if (message.includes("mod_slow_down")) return "You're sending messages quickly. Please wait a moment.";
  if (message.includes("section_off")) return "Communities are coming soon. Press Notify me and we'll tell you when they open.";
  if (message.includes("pending_review")) return "This community is waiting for the team's approval.";
  if (message.includes("too_many_communities")) return "You've created 3 communities today. Please try again tomorrow.";
  if (message.includes("too_many_invites")) return "You've sent a lot of invites in the last hour. Please wait a little.";
  if (message.includes("owner_must_transfer")) return "Hand the community to another member before leaving, or delete it.";
  if (message.includes("archived_by_team")) return "The VentureWeavers team archived this community. Message the team to restore it.";
  if (message.includes("not_allowed")) return "Only the community's owner or admins can do that.";
  if (message.includes("bad_cover")) return "Upload the cover image again.";
  if (message.includes("not_found")) return "This community isn't available.";
  if (message.includes("_check")) return "Please check the details and try again.";
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------- posts (19c)

export type WallPost = {
  id: string; author: string; name: string; avatar_url: string | null; body: string; link_url: string | null; image_url: string | null;
  pinned: boolean; comments_closed: boolean; mod_status: "live" | "held" | "hidden"; created_at: string; edited_at: string | null;
  likes: number; comments: number; views: number; shares: number; liked: boolean; saved: boolean;
};

export type PostComment = {
  id: string; parent_id: string | null; author: string; name: string; avatar_url: string | null; body: string;
  mod_status: "live" | "held" | "hidden"; created_at: string; likes: number; liked: boolean;
};

export type SavedItem = { kind: "post" | "room_message"; id: string; author: string; body: string; place: string; href: string; saved_at: string };

export const POST_LIMITS = { body: 3000, comment: 1000 } as const;

/** Reads the post composer: text, and an optional https link (https:// added when missing). */
export function parsePost(body: unknown, link: unknown): { ok: true; body: string; link: string | null } | { ok: false; error: string } {
  const b = String(body ?? "").trim();
  if (!b || b.length > POST_LIMITS.body) return { ok: false, error: "Write a post (up to 3,000 characters)." };
  let l = String(link ?? "").trim();
  if (!l) return { ok: true, body: b, link: null };
  if (!/^https?:\/\//i.test(l)) l = `https://${l}`;
  l = l.replace(/^http:\/\//i, "https://");
  if (l.length > 500 || !/^https:\/\/[^\s<>"]+\.[^\s<>"]+$/.test(l)) return { ok: false, error: "That link doesn't look like a web address." };
  return { ok: true, body: b, link: l };
}

/** Comments in order, replies under their comment. */
export function threadComments(list: PostComment[]): { comment: PostComment; replies: PostComment[] }[] {
  const top = list.filter((c) => !c.parent_id);
  return top.map((c) => ({ comment: c, replies: list.filter((r) => r.parent_id === c.id) }));
}

/** "1.2k" for big counts. */
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));
