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
