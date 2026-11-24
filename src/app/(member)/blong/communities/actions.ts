"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { communityError, parseCommunity, type CommunityStatus } from "@/lib/blong/communities";
import { isUuid } from "@/lib/blong/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkUpload, contentMatches, extOf, sniff, UPLOAD_RULES } from "@/lib/uploads";

type Result<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

async function rpc<T = undefined>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  if (!(await getMember())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: communityError(error.message) };
  return { ok: true, value: data as T };
}

const refresh = () => {
  revalidatePath("/blong/communities", "layout");
};

/** A cover the member uploaded: content-images/communities/<member>/<uuid>.<ext>. */
const coverOf = (memberId: string) => (url: string) =>
  new RegExp(`^https://[a-z0-9-]+\\.supabase\\.co/storage/v1/object/public/content-images/communities/${memberId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(url);

export async function startCover(name: string, size: number): Promise<{ ok: true; path: string; url: string; contentType: string } | { ok: false; error: string }> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Sign in to upload an image." };
  const bad = checkUpload("content-images", name, size);
  if (bad) return { ok: false, error: bad };
  const ext = extOf(name) === "jpeg" ? "jpg" : extOf(name);
  const path = `communities/${m.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createServiceClient().storage.from("content-images").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Please try again." };
  return { ok: true, path, url: data.signedUrl, contentType: UPLOAD_RULES["content-images"].types[extOf(name)] };
}

/** Checks the uploaded file really is an image within 5 MB and returns its address. */
export async function finishCover(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Sign in to upload an image." };
  if (!new RegExp(`^communities/${m.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return { ok: false, error: "Unknown upload." };
  const bucket = createServiceClient().storage.from("content-images");
  const { data: blob, error } = await bucket.download(path);
  if (error || !blob) return { ok: false, error: "The upload didn't arrive. Please try again." };
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (blob.size > UPLOAD_RULES["content-images"].maxBytes || !contentMatches(extOf(path), sniff(head))) {
    await bucket.remove([path]);
    return { ok: false, error: "That file isn't a JPG, PNG or WebP image under 5 MB." };
  }
  return { ok: true, url: bucket.getPublicUrl(path).data.publicUrl };
}

/** Creates a community (or saves an edit when `id` is set). Returns its slug. */
export async function saveCommunity(id: string | null, form: FormData, keepCover: string | null = null): Promise<Result<string>> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Please sign in again." };
  const parsed = parseCommunity(form, (u) => coverOf(m.id)(u) || (keepCover !== null && u === keepCover));
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const args = { p_name: v.name, p_description: v.description, p_type: v.type, p_topics: v.topics, p_audience: v.audience, p_visibility: v.visibility, p_cover: v.cover };
  if (id) {
    if (!isUuid(id)) return { ok: false, error: "This community isn't available." };
    const r = await rpc("update_community", { p_id: id, ...args });
    refresh();
    return r;
  }
  const r = await rpc<string>("create_community", args);
  refresh();
  return r;
}

export async function joinCommunity(id: string): Promise<Result<CommunityStatus>> {
  if (!isUuid(id)) return { ok: false, error: "This community isn't available." };
  const r = await rpc<CommunityStatus>("join_community", { p_id: id });
  refresh();
  return r;
}

/** Leave, take back a request or decline an invite. */
export async function leaveCommunity(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This community isn't available." };
  const r = await rpc("leave_community", { p_id: id });
  refresh();
  return r;
}

export async function respondToJoin(id: string, member: string, accept: boolean): Promise<Result> {
  if (!isUuid(id) || !isUuid(member)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("respond_join", { p_id: id, p_member: member, p_accept: accept });
  refresh();
  return r;
}

export async function inviteToCommunity(id: string, member: string): Promise<Result<string>> {
  if (!isUuid(id) || !isUuid(member)) return { ok: false, error: "This member isn't available." };
  const r = await rpc<string>("invite_to_community", { p_id: id, p_member: member });
  refresh();
  return r;
}

export async function setCommunityRole(id: string, member: string, role: "admin" | "member"): Promise<Result> {
  if (!isUuid(id) || !isUuid(member) || !["admin", "member"].includes(role)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("set_community_role", { p_id: id, p_member: member, p_role: role });
  refresh();
  return r;
}

export async function removeFromCommunity(id: string, member: string): Promise<Result> {
  if (!isUuid(id) || !isUuid(member)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("remove_community_member", { p_id: id, p_member: member });
  refresh();
  return r;
}

export async function transferCommunity(id: string, member: string): Promise<Result> {
  if (!isUuid(id) || !isUuid(member)) return { ok: false, error: "This member isn't available." };
  const r = await rpc("transfer_community", { p_id: id, p_member: member });
  refresh();
  return r;
}

export async function setCommunityStatus(id: string, status: "active" | "archived"): Promise<Result> {
  if (!isUuid(id) || !["active", "archived"].includes(status)) return { ok: false, error: "This community isn't available." };
  const r = await rpc("set_community_status", { p_id: id, p_status: status });
  refresh();
  return r;
}

export async function deleteCommunity(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "This community isn't available." };
  const r = await rpc("delete_community", { p_id: id });
  refresh();
  return r;
}

/** Members to invite, by name or business (the same directory as Networking). */
export async function searchMembers(q: string): Promise<{ id: string; name: string; avatar_url: string | null; roles: string[] }[]> {
  if (!(await getMember()) || q.trim().length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_directory", { p_q: q.trim().slice(0, 80), p_role: null, p_limit: 8, p_offset: 0 });
  return ((data ?? []) as { id: string; name: string; avatar_url: string | null; roles: string[] }[]).map(({ id, name, avatar_url, roles }) => ({ id, name, avatar_url, roles }));
}
