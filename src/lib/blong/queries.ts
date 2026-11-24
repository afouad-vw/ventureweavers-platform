import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { CommunityPage, CommunityPerson, CommunityRow, CommunityTab, PostComment, SavedItem, WallPost } from "./communities";
import type { DiscussionPage, DiscussionRow, DiscussionTab, RoomMessage } from "./discussions";
import { isUuid, type Activity, type BlongSections, type DmMessage, type DmThread, type FeedItem, type MemberCard, type MemberLite } from "./format";

/** Members to follow (the database leaves out admins, suspended members, blocks and yourself). */
export async function memberDirectory(q?: string, role?: string): Promise<MemberLite[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_directory", { p_q: q?.slice(0, 80) || null, p_role: role || null, p_limit: 90, p_offset: 0 });
  return (data ?? []) as MemberLite[];
}

/** One member's card, as much as their privacy allows; null when blocked or not available. */
export async function memberCard(id: string): Promise<MemberCard | null> {
  if (!supabaseConfigured || !isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_card", { p_id: id });
  return (data ?? null) as MemberCard | null;
}

export async function myNetwork(kind: "following" | "followers" | "requests" | "sent"): Promise<MemberLite[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_network", { p_kind: kind });
  return (data ?? []) as MemberLite[];
}

export async function myBlocked(): Promise<{ id: string; name: string; avatar_url: string | null; since: string }[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_blocked");
  return (data ?? []) as { id: string; name: string; avatar_url: string | null; since: string }[];
}

export async function myDmThreads(): Promise<DmThread[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_dm_threads");
  return (data ?? []) as DmThread[];
}

/** Messages in one of the member's chats (row level security keeps it to their own). */
export async function dmMessages(threadId: string): Promise<DmMessage[]> {
  if (!supabaseConfigured || !isUuid(threadId)) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("dm_messages").select("id, author, body, created_at").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as DmMessage[]).reverse();
}

export async function myDmUnread(): Promise<number> {
  if (!supabaseConfigured) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_dm_unread");
  return typeof data === "number" ? data : 0;
}

export type MyPrivacy = { visibility: "public" | "private"; bio: string | null; links: { label: string; url: string }[]; show_activity: string[] };

export async function myPrivacy(memberId: string): Promise<MyPrivacy> {
  const fallback: MyPrivacy = { visibility: "private", bio: null, links: [], show_activity: ["events", "programs", "communities", "posts"] };
  if (!supabaseConfigured) return fallback;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("visibility, bio, links, show_activity").eq("id", memberId).maybeSingle();
  return (data as MyPrivacy | null) ?? fallback;
}

// ---------------------------------------------------------------- communities (18b)


export async function listCommunities(scope: CommunityTab, q?: string, type?: string): Promise<CommunityRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_communities", { p_scope: scope, p_q: q?.slice(0, 80) || null, p_type: type || null });
  return (data ?? []) as CommunityRow[];
}

export async function communityPage(slug: string): Promise<CommunityPage | null> {
  if (!supabaseConfigured || !/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("community_page", { p_slug: slug });
  return (data ?? null) as CommunityPage | null;
}

export async function communityPeople(id: string): Promise<CommunityPerson[]> {
  if (!supabaseConfigured || !isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("community_people", { p_id: id });
  return (data ?? []) as CommunityPerson[];
}

// ---------------------------------------------------------------- discussions (18c)

export async function listDiscussions(scope: DiscussionTab, opts: { q?: string; category?: string; community?: string } = {}): Promise<DiscussionRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_discussions", {
    p_scope: scope,
    p_q: opts.q?.slice(0, 80) || null,
    p_category: opts.category || null,
    p_community: opts.community && isUuid(opts.community) ? opts.community : null,
  });
  return (data ?? []) as DiscussionRow[];
}

export async function discussionPage(slug: string): Promise<DiscussionPage | null> {
  if (!supabaseConfigured || !/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("discussion_page", { p_slug: slug });
  return (data ?? null) as DiscussionPage | null;
}

export async function discussionPeople(id: string): Promise<CommunityPerson[]> {
  if (!supabaseConfigured || !isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("discussion_people", { p_id: id });
  return (data ?? []) as CommunityPerson[];
}

export async function roomMessages(id: string): Promise<RoomMessage[]> {
  if (!supabaseConfigured || !isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("room_messages", { p_id: id, p_after: null });
  return (data ?? []) as RoomMessage[];
}

// ---------------------------------------------------------------- activity and feed (18d)

/** What a member did, as far as their privacy and choices allow the viewer to see. */
export async function memberActivity(id: string): Promise<Activity[]> {
  if (!supabaseConfigured || !isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_activity", { p_id: id, p_limit: 30 });
  return (data ?? []) as Activity[];
}

/** Updates from the people the member follows. */
export async function blongFeed(): Promise<FeedItem[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_feed", { p_limit: 60 });
  return (data ?? []) as FeedItem[];
}

// ---------------------------------------------------------------- admin controls (19a)

/** Which BLong sections are open (both, when the database can't say). */
export async function blongSections(): Promise<BlongSections> {
  const open: BlongSections = { communities: true, discussions: true };
  if (!supabaseConfigured) return open;
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_sections");
  return { ...open, ...((data ?? {}) as Partial<BlongSections>) };
}

export type BlongSettings = {
  communities_on: boolean; discussions_on: boolean; approve_communities: boolean; approve_discussions: boolean; updated_at: string; updated_by: string | null;
  blocked_words: string[]; blocked_action: "hold" | "reject"; blocked_domains: string[]; max_links: number; link_new_days: number; per_minute: number;
  new_member_days: number; new_member_hold: number; auto_hide_reports: number;
};

export async function blongAdminSettings(): Promise<BlongSettings | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_admin_settings");
  return (data ?? null) as BlongSettings | null;
}

export type PendingItem = {
  kind: "community" | "discussion"; id: string; slug: string; name: string; description: string; label: string; privacy: string;
  cover_url: string | null; community: string | null; owner_id: string; owner_name: string; resubmitted: boolean; created_at: string;
};

export async function blongPending(): Promise<PendingItem[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_pending");
  return (data ?? []) as PendingItem[];
}

export type BlongStats = {
  members: number; public: number; follows: number; follows_30: number;
  communities: Record<string, number> | null; discussions: Record<string, number> | null;
  communities_30: number; discussions_30: number; room_messages: number; room_messages_30: number; member_messages_30: number; joins_30: number;
  active_7: number; active_30: number; reports_open: number; reports_handled_30: number; handle_hours: number | null; pending: number;
  daily: { day: string; messages: number; joins: number; active: number }[];
  top_communities: { name: string; slug: string; status: string; members: number; score: number }[];
  top_discussions: { name: string; slug: string; status: string; members: number; score: number }[];
};

export async function blongStats(): Promise<BlongStats | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_stats");
  return (data ?? null) as BlongStats | null;
}

// ---------------------------------------------------------------- moderation (19b)

export type HeldMessage = {
  /** room_message, post or comment. room_slug is the item's address in the member app. */
  kind: "room_message" | "post" | "comment";
  id: string; body: string; mod_status: "held" | "hidden"; mod_rule: string | null; author_id: string; author_name: string;
  room_title: string; room_slug: string; reports: number; created_at: string;
};

export async function blongHeld(): Promise<HeldMessage[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_held");
  return (data ?? []) as HeldMessage[];
}

export async function blongWatch(): Promise<{ member_id: string; name: string; caught: number; last_at: string }[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_watch");
  return (data ?? []) as { member_id: string; name: string; caught: number; last_at: string }[];
}

export type ModStats = {
  held_now: number; hidden_now: number; held_30: number; hidden_30: number; removed_30: number;
  posts_30?: number; comments_30?: number; likes_30?: number; shares_30?: number; saves_30?: number;
};

export async function blongModStats(): Promise<ModStats | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("blong_mod_stats");
  return (data ?? null) as ModStats | null;
}

// ---------------------------------------------------------------- posts and engagement (19c)

export async function communityWall(id: string, post?: string): Promise<WallPost[]> {
  if (!supabaseConfigured || !isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("community_wall", { p_community: id, p_before: null, p_post: post && isUuid(post) ? post : null });
  return (data ?? []) as WallPost[];
}

export async function postComments(id: string): Promise<PostComment[]> {
  if (!supabaseConfigured || !isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("post_comments_list", { p_post: id });
  return (data ?? []) as PostComment[];
}

export async function mySaved(): Promise<SavedItem[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_saved");
  return (data ?? []) as SavedItem[];
}
