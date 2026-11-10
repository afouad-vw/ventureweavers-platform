"use server";

import { revalidatePath } from "next/cache";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function signedInClient() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? { supabase, id: data.claims.sub as string } : null;
}

/** Bookmark or un-bookmark a blog post, Library resource or feed post. */
export async function toggleSaved(type: "blog" | "resource" | "post", itemId: string, save: boolean): Promise<Result> {
  if (!["blog", "resource", "post"].includes(type) || !ID.test(itemId)) return { ok: false, error: "That item can't be saved." };
  const s = await signedInClient();
  if (!s) return { ok: false, error: "Sign in to save items." };
  const { error } = save
    ? await s.supabase.from("saved_items").upsert({ member_id: s.id, item_type: type, item_id: itemId }, { onConflict: "member_id,item_type,item_id", ignoreDuplicates: true })
    : await s.supabase.from("saved_items").delete().eq("item_type", type).eq("item_id", itemId);
  if (error) return { ok: false, error: "Couldn't update your saved items." };
  revalidatePath("/my-space");
  return { ok: true, message: save ? "Saved to My space" : "Removed from saved" };
}

/** Outloud › Suggest a topic. The partners see it in the admin console. */
export async function suggestTopic(text: string): Promise<Result> {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length < 5) return { ok: false, error: "Write a little more (at least 5 characters)." };
  if (clean.length > 500) return { ok: false, error: "Keep it under 500 characters." };
  const s = await signedInClient();
  if (!s) return { ok: false, error: "Sign in to suggest a topic." };
  const { error } = await s.supabase.from("topic_suggestions").insert({ text: clean });
  if (error) return { ok: false, error: error.message.includes("topic_limit") ? "You've sent 5 topics today. Thank you! Send more tomorrow." : "Couldn't send your topic. Please try again." };
  return { ok: true, message: "Topic sent to the hosts" };
}

/** The Floor Notes on or off (same setting as in My space › Profile & settings). */
export async function setNewsletter(on: boolean): Promise<Result> {
  const s = await signedInClient();
  if (!s) return { ok: false, error: "Sign in to get The Floor Notes." };
  const { error } = await s.supabase.from("profiles").update({ consent_newsletter: on }).eq("id", s.id);
  if (error) return { ok: false, error: "Couldn't update the setting." };
  revalidatePath("/my-space");
  return { ok: true, message: on ? "You'll get The Floor Notes by email" : "The Floor Notes turned off" };
}

/**
 * Open a Library resource. The database checks the member's access level; files get a download
 * link that expires after 5 minutes, so links can't be passed around.
 */
export async function openResource(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ID.test(id)) return { ok: false, error: "That resource doesn't exist." };
  const s = await signedInClient();
  if (!s) return { ok: false, error: "Sign in to open the Library." };
  const { data, error } = await s.supabase.rpc("open_resource", { p_id: id });
  if (error || !data) {
    const m = error?.message ?? "";
    if (m.includes("locked")) return { ok: false, error: "This resource opens with a different membership level." };
    if (m.includes("no_file")) return { ok: false, error: "This resource is coming soon." };
    return { ok: false, error: "That resource isn't available." };
  }
  const r = data as { file_path: string | null; file_name: string | null; link_url: string | null };
  if (r.link_url) return { ok: true, url: r.link_url };
  const { data: signed, error: e2 } = await createServiceClient()
    .storage.from("library-files")
    .createSignedUrl(r.file_path!, 300, { download: r.file_name || true });
  if (e2 || !signed?.signedUrl) return { ok: false, error: "Couldn't prepare the download. Please try again." };
  return { ok: true, url: signed.signedUrl };
}
