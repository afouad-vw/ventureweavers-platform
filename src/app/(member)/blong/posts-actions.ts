"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { communityError, parsePost, POST_LIMITS, type PostComment, type WallPost } from "@/lib/blong/communities";
import { isUuid } from "@/lib/blong/format";
import { communityWall, postComments } from "@/lib/blong/queries";
import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };
type Kind = "post" | "comment" | "room_message";
const KINDS: readonly Kind[] = ["post", "comment", "room_message"];

async function rpc<T = undefined>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  if (!(await getMember())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: communityError(error.message) };
  return { ok: true, value: data as T };
}

const refresh = () => revalidatePath("/blong/communities/[slug]", "page");
/** A post image the member uploaded: content-images/communities/<member>/<uuid>.<ext>. */
const ownImage = (memberId: string, url: string | null) => !url || new RegExp(`/content-images/communities/${memberId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(url);

export async function createPost(community: string, body: string, link: string, image: string | null): Promise<Result<string>> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Please sign in again." };
  if (!isUuid(community)) return { ok: false, error: "This community isn't available." };
  const p = parsePost(body, link);
  if (!p.ok) return p;
  if (!ownImage(m.id, image)) return { ok: false, error: "Upload the image again." };
  const r = await rpc<string>("create_post", { p_community: community, p_body: p.body, p_link: p.link, p_image: image });
  refresh();
  return r;
}

export async function updatePost(id: string, body: string, link: string, image: string | null): Promise<Result> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Please sign in again." };
  if (!isUuid(id)) return { ok: false, error: "This post isn't available." };
  const p = parsePost(body, link);
  if (!p.ok) return p;
  const r = await rpc("update_post", { p_id: id, p_body: p.body, p_link: p.link, p_image: image });
  refresh();
  return r;
}

export async function removePost(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This post isn't available." };
  const r = await rpc("remove_post", { p_id: id });
  refresh();
  return r;
}

export async function setPostFlags(id: string, flags: { pinned?: boolean; commentsClosed?: boolean }): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This post isn't available." };
  const r = await rpc("set_post_flags", { p_id: id, p_pinned: flags.pinned ?? null, p_comments_closed: flags.commentsClosed ?? null });
  refresh();
  return r;
}

export async function setCommunityPosting(id: string, posting: "members" | "admins"): Promise<Result> {
  if (!isUuid(id) || !["members", "admins"].includes(posting)) return { ok: false, error: "This community isn't available." };
  const r = await rpc("set_community_posting", { p_id: id, p_posting: posting });
  refresh();
  return r;
}

export async function addComment(post: string, body: string, parent: string | null): Promise<Result<string>> {
  const text = body.trim();
  if (!isUuid(post) || (parent !== null && !isUuid(parent))) return { ok: false, error: "This post isn't available." };
  if (!text || text.length > POST_LIMITS.comment) return { ok: false, error: "Write a comment (up to 1,000 characters)." };
  return rpc<string>("add_comment", { p_post: post, p_body: text, p_parent: parent });
}

export async function removeComment(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This comment isn't available." };
  return rpc("remove_comment", { p_id: id });
}

export async function fetchComments(post: string): Promise<PostComment[] | null> {
  if (!(await getMember()) || !isUuid(post)) return null;
  return postComments(post);
}

export async function fetchWall(community: string): Promise<WallPost[] | null> {
  if (!(await getMember()) || !isUuid(community)) return null;
  return communityWall(community);
}

// ---------------------------------------------------------------- engagement (posts, comments, discussion messages)

export async function toggleLike(kind: Kind, id: string): Promise<Result<{ liked: boolean; likes: number }>> {
  if (!KINDS.includes(kind) || !isUuid(id)) return { ok: false, error: "This isn't available." };
  return rpc<{ liked: boolean; likes: number }>("toggle_like", { p_kind: kind, p_id: id });
}

export async function toggleBookmark(kind: "post" | "room_message", id: string): Promise<Result<boolean>> {
  if (!["post", "room_message"].includes(kind) || !isUuid(id)) return { ok: false, error: "This isn't available." };
  const r = await rpc<boolean>("toggle_bookmark", { p_kind: kind, p_id: id });
  revalidatePath("/my-space");
  return r;
}

export async function recordViews(kind: "post" | "room_message", ids: string[]): Promise<void> {
  const clean = [...new Set(ids)].filter(isUuid).slice(0, 100);
  if (!clean.length || !["post", "room_message"].includes(kind)) return;
  await rpc("record_views", { p_kind: kind, p_ids: clean }).catch(() => null);
}

export async function recordShare(kind: "post" | "room_message", id: string, channel: "link" | "device" | "member"): Promise<void> {
  if (!["post", "room_message"].includes(kind) || !isUuid(id) || !["link", "device", "member"].includes(channel)) return;
  await rpc("record_share", { p_kind: kind, p_id: id, p_channel: channel }).catch(() => null);
}
