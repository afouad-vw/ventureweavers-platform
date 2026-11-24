"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { isUuid, parseRules } from "@/lib/blong/format";
import { createClient } from "@/lib/supabase/server";
import { sendWaitlistEmails } from "@/lib/waitlist-server";

type Result = { ok: true } | { ok: false; error: string };

/** Mark a report handled or dismissed (or reopen it), with an optional note for the team. */
export async function handleReport(id: string, status: "open" | "handled" | "dismissed", note: string): Promise<Result> {
  const admin = await requireAdmin("community.manage");
  if (!isUuid(id) || !["open", "handled", "dismissed"].includes(status)) return { ok: false, error: "Unknown report." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_handle_report", { p_id: id, p_status: status, p_note: note.trim().slice(0, 1000) || null });
  if (error) return { ok: false, error: error.message.includes("not_admin") ? "You can view reports but not handle them." : "Couldn't update the report." };
  await audit(admin.userId, `report.${status}`, "reports", { entityId: id, after: { status, note: note.trim() || null } }).catch(() => null);
  revalidatePath("/admin/community");
  return { ok: true };
}

/** Archive or restore a community (staff). The owner is told when the team archives it. */
export async function setCommunityStatusAdmin(id: string, status: "active" | "archived"): Promise<Result> {
  const admin = await requireAdmin("community.manage");
  if (!isUuid(id) || !["active", "archived"].includes(status)) return { ok: false, error: "Unknown community." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_community_status", { p_id: id, p_status: status });
  if (error) return { ok: false, error: "Couldn't change the community." };
  await audit(admin.userId, `community.${status}`, "communities", { entityId: id, after: { status } }).catch(() => null);
  revalidatePath("/admin/community");
  return { ok: true };
}

/** Archive or restore a discussion (staff). The host is told when the team archives it. */
export async function setDiscussionStatusAdmin(id: string, status: "open" | "archived"): Promise<Result> {
  const admin = await requireAdmin("community.manage");
  if (!isUuid(id) || !["open", "archived"].includes(status)) return { ok: false, error: "Unknown discussion." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_discussion_status", { p_id: id, p_status: status });
  if (error) return { ok: false, error: "Couldn't change the discussion." };
  await audit(admin.userId, `discussion.${status}`, "discussions", { entityId: id, after: { status } }).catch(() => null);
  revalidatePath("/admin/community");
  return { ok: true };
}

/** Approve a community or discussion (it goes live) or decline it with a note. The creator is told in their bell. */
export async function reviewBlongItem(kind: "community" | "discussion", id: string, approve: boolean, note: string): Promise<Result> {
  await requireAdmin("community.manage");
  if (!isUuid(id) || !["community", "discussion"].includes(kind)) return { ok: false, error: "Unknown item." };
  const clean = note.trim().slice(0, 1000);
  if (!approve && !clean) return { ok: false, error: "Add a short note so the member knows what to change." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_blong_item", { p_kind: kind, p_id: id, p_approve: approve, p_note: clean || null });
  if (error) return { ok: false, error: error.message.includes("not_found") ? "Someone already reviewed this." : error.message.includes("not_admin") ? "You can view the queue but not approve." : "Couldn't save the review." };
  revalidatePath("/admin/community");
  revalidatePath("/blong", "layout");
  return { ok: true };
}

export type BlongSettingsPatch = Partial<Record<"communities_on" | "discussions_on" | "approve_communities" | "approve_discussions", boolean>>;

/** Section switches and approval settings. Turning a section on emails its Notify me list (the bell is sent by the database). */
export async function saveBlongSettings(patch: BlongSettingsPatch): Promise<Result> {
  await requireAdmin("community.manage");
  const keys = ["communities_on", "discussions_on", "approve_communities", "approve_discussions"] as const;
  const clean = Object.fromEntries(keys.filter((k) => typeof patch[k] === "boolean").map((k) => [k, patch[k]]));
  if (!Object.keys(clean).length) return { ok: false, error: "Nothing to change." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_blong_settings", { p: clean });
  if (error) return { ok: false, error: error.message.includes("not_admin") ? "Only staff with Community (manage) change these." : "Couldn't save the setting." };
  if (clean.communities_on === true || clean.discussions_on === true) await sendWaitlistEmails().catch(() => 0);
  revalidatePath("/admin/community");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Publish or remove a message the rules held, or that reports hid. Its open reports are closed; the author is told. */
export async function reviewHeldMessage(id: string, publish: boolean): Promise<Result> {
  await requireAdmin("community.manage");
  if (!isUuid(id)) return { ok: false, error: "Unknown message." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_held_message", { p_id: id, p_publish: publish });
  if (error) return { ok: false, error: error.message.includes("not_found") ? "Someone already reviewed this." : "Couldn't save the review." };
  revalidatePath("/admin/community");
  return { ok: true };
}

/** The automatic moderation rules. */
export async function saveModerationRules(form: FormData): Promise<Result> {
  await requireAdmin("community.manage");
  const parsed = parseRules(form);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_blong_settings", { p: parsed.value });
  if (error) return { ok: false, error: error.message.includes("not_admin") ? "Only staff with Community (manage) change these." : "Couldn't save the rules." };
  revalidatePath("/admin/community");
  return { ok: true };
}
