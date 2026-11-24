"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { discussionError, parseDiscussion, type RoomMemberStatus, type RoomMessage } from "@/lib/blong/discussions";
import { isUuid } from "@/lib/blong/format";
import { alertIfPending, reviewState } from "@/lib/blong/review-alert";
import { cleanMessage } from "@/lib/messages/format";
import { roomMessages } from "@/lib/blong/queries";
import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

async function rpc<T = undefined>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  if (!(await getMember())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: discussionError(error.message) };
  return { ok: true, value: data as T };
}

const refresh = () => {
  revalidatePath("/blong/discussions", "layout");
  revalidatePath("/blong/communities", "layout");
};
const bad = { ok: false as const, error: "This discussion isn't available." };

/** Starts a discussion (or saves an edit when `id` is set). Returns its slug. */
export async function saveDiscussion(id: string | null, form: FormData): Promise<Result<string>> {
  const parsed = parseDiscussion(form);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (id) {
    if (!isUuid(id)) return bad;
    const before = (await reviewState("discussion", { id }))?.status ?? null;
    const r = await rpc("update_discussion", { p_id: id, p_title: v.title, p_description: v.description, p_category: v.category, p_tags: v.tags, p_limit: v.limit, p_privacy: v.privacy });
    if (r.ok) await alertIfPending("discussion", { id }, before);
    refresh();
    return r;
  }
  if (v.community && !isUuid(v.community)) return bad;
  const r = await rpc<string>("create_discussion", {
    p_title: v.title, p_description: v.description, p_category: v.category, p_tags: v.tags, p_limit: v.limit, p_privacy: v.privacy, p_community: v.community,
  });
  if (r.ok && r.value) await alertIfPending("discussion", { slug: r.value });
  refresh();
  return r;
}

export async function joinDiscussion(id: string): Promise<Result<RoomMemberStatus>> {
  if (!isUuid(id)) return bad;
  const r = await rpc<RoomMemberStatus>("join_discussion", { p_id: id });
  refresh();
  return r;
}

export async function leaveDiscussion(id: string): Promise<Result> {
  if (!isUuid(id)) return bad;
  const r = await rpc("leave_discussion", { p_id: id });
  refresh();
  return r;
}

export async function respondToDiscussionJoin(id: string, member: string, accept: boolean): Promise<Result> {
  if (!isUuid(id) || !isUuid(member)) return bad;
  const r = await rpc("respond_discussion_join", { p_id: id, p_member: member, p_accept: accept });
  refresh();
  return r;
}

export async function inviteToDiscussion(id: string, member: string): Promise<Result<string>> {
  if (!isUuid(id) || !isUuid(member)) return bad;
  const r = await rpc<string>("invite_to_discussion", { p_id: id, p_member: member });
  refresh();
  return r;
}

export async function setDiscussionRole(id: string, member: string, role: "admin" | "member"): Promise<Result> {
  if (!isUuid(id) || !isUuid(member) || !["admin", "member"].includes(role)) return bad;
  const r = await rpc("set_discussion_role", { p_id: id, p_member: member, p_role: role });
  refresh();
  return r;
}

export async function removeFromDiscussion(id: string, member: string): Promise<Result> {
  if (!isUuid(id) || !isUuid(member)) return bad;
  const r = await rpc("remove_discussion_member", { p_id: id, p_member: member });
  refresh();
  return r;
}

export async function transferDiscussion(id: string, member: string): Promise<Result> {
  if (!isUuid(id) || !isUuid(member)) return bad;
  const r = await rpc("transfer_discussion", { p_id: id, p_member: member });
  refresh();
  return r;
}

export async function setDiscussionStatus(id: string, status: "open" | "closed" | "archived"): Promise<Result> {
  if (!isUuid(id) || !["open", "closed", "archived"].includes(status)) return bad;
  const r = await rpc("set_discussion_status", { p_id: id, p_status: status });
  refresh();
  return r;
}

export async function deleteDiscussion(id: string): Promise<Result> {
  if (!isUuid(id)) return bad;
  const r = await rpc("delete_discussion", { p_id: id });
  refresh();
  return r;
}

export async function postRoomMessage(id: string, raw: string, replyTo: string | null): Promise<Result<string>> {
  const body = cleanMessage(raw);
  if (!isUuid(id) || !body || (replyTo !== null && !isUuid(replyTo))) return { ok: false, error: "Write a message (up to 2,000 characters)." };
  return rpc<string>("post_room_message", { p_id: id, p_body: body, p_reply_to: replyTo });
}

export async function removeRoomMessage(messageId: string): Promise<Result> {
  if (!isUuid(messageId)) return bad;
  return rpc("remove_room_message", { p_message: messageId });
}

export async function pinRoomMessage(id: string, messageId: string | null): Promise<Result> {
  if (!isUuid(id) || (messageId !== null && !isUuid(messageId))) return bad;
  const r = await rpc("pin_room_message", { p_id: id, p_message: messageId });
  revalidatePath("/blong/discussions/[slug]", "page");
  return r;
}

/** For live updates and the 10-second refresh. */
export async function fetchRoom(id: string): Promise<RoomMessage[] | null> {
  if (!(await getMember()) || !isUuid(id)) return null;
  return roomMessages(id);
}
