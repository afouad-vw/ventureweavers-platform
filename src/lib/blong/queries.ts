import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type DmMessage, type DmThread, type MemberCard, type MemberLite } from "./format";

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
