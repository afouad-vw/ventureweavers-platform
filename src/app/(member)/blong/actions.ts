"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { ACTIVITY_KINDS, blongError, cleanBio, cleanLinks, isReportReason, isUuid, type DmMessage, type DmThread, type FollowState } from "@/lib/blong/format";
import { dmMessages, myDmThreads, myDmUnread } from "@/lib/blong/queries";
import { cleanMessage } from "@/lib/messages/format";
import { createClient } from "@/lib/supabase/server";

export type Result<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

async function rpc<T = undefined>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  if (!(await getMember())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: blongError(error.message) };
  return { ok: true, value: data as T };
}

const refresh = () => {
  revalidatePath("/blong/networking");
  revalidatePath("/blong/members/[id]", "page");
};

export async function followMember(id: string): Promise<Result<FollowState>> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  const r = await rpc<FollowState>("follow_member", { p_id: id });
  refresh();
  return r;
}

/** Unfollow, or take back a follow request. */
export async function unfollowMember(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("unfollow_member", { p_id: id });
  refresh();
  return r;
}

export async function respondToFollow(id: string, accept: boolean): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("respond_follow", { p_follower: id, p_accept: accept });
  refresh();
  return r;
}

export async function removeFollower(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("remove_follower", { p_follower: id });
  refresh();
  return r;
}

export async function blockMember(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("block_member", { p_id: id });
  refresh();
  revalidatePath("/messages");
  return r;
}

export async function unblockMember(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("unblock_member", { p_id: id });
  revalidatePath("/my-space");
  return r;
}

export async function reportContent(kind: "member" | "message", target: string, reason: string, details: string): Promise<Result> {
  if (!isUuid(target) || !["member", "message"].includes(kind) || !isReportReason(reason)) return { ok: false, error: "Please pick a reason." };
  return rpc("report_content", { p_kind: kind, p_target: target, p_reason: reason, p_details: details.trim().slice(0, 1000) || null });
}

/** Opens (or finds) the chat with a member and returns its id. */
export async function startChat(id: string): Promise<Result<string>> {
  if (!isUuid(id)) return { ok: false, error: "This member isn't available." };
  return rpc<string>("start_dm", { p_id: id });
}

export async function sendChatMessage(threadId: string, raw: string): Promise<Result> {
  const body = cleanMessage(raw);
  if (!isUuid(threadId) || !body) return { ok: false, error: "Write a message (up to 2,000 characters)." };
  return rpc("send_dm", { p_thread: threadId, p_body: body });
}

export async function markChatRead(threadId: string): Promise<void> {
  if (!isUuid(threadId) || !(await getMember())) return;
  const supabase = await createClient();
  await supabase.rpc("mark_dm_read", { p_thread: threadId });
}

/** For the 10-second refresh and live updates. */
export async function fetchChats(threadId: string | null): Promise<{ threads: DmThread[]; messages: DmMessage[] } | null> {
  if (!(await getMember())) return null;
  const [threads, messages] = await Promise.all([myDmThreads(), threadId && isUuid(threadId) ? dmMessages(threadId) : Promise.resolve([])]);
  return { threads, messages };
}

export async function fetchChatUnread(): Promise<number | null> {
  if (!(await getMember())) return null;
  return myDmUnread();
}

export type PrivacyInput = { visibility: "public" | "private"; bio: string; links: { label: string; url: string }[]; activity: string[] };

/** Saves the member's own privacy, bio and links (row level security limits it to their row). */
export async function savePrivacy(input: PrivacyInput): Promise<Result> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Please sign in again." };
  let links: { label: string; url: string }[];
  try {
    links = cleanLinks(input.links ?? []);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const known = new Set<string>(ACTIVITY_KINDS.map((a) => a.key));
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      visibility: input.visibility === "public" ? "public" : "private",
      bio: cleanBio(input.bio),
      links,
      show_activity: (input.activity ?? []).filter((a) => known.has(a)),
    })
    .eq("id", m.id);
  if (error) return { ok: false, error: "Your changes didn't save. Please try again." };
  revalidatePath("/my-space");
  return { ok: true };
}
