"use server";

import { revalidatePath } from "next/cache";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkUpload, contentMatches, extOf, sniff, UPLOAD_RULES } from "@/lib/uploads";

type Result = { ok: true; url: string | null } | { ok: false; error: string };
const RULE = UPLOAD_RULES.avatars;

async function me() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { id: String(id), supabase } : null;
}

/** Step 1: a one-time upload link into the member's own folder in the public "avatars" bucket. */
export async function startAvatarUpload(name: string, size: number): Promise<{ ok: true; path: string; url: string; contentType: string } | { ok: false; error: string }> {
  const m = await me();
  if (!m) return { ok: false, error: "Sign in to change your photo." };
  const bad = checkUpload("avatars", name, size);
  if (bad) return { ok: false, error: bad };
  const ext = extOf(name) === "jpeg" ? "jpg" : extOf(name);
  const path = `${m.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createServiceClient().storage.from("avatars").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Please try again." };
  return { ok: true, path, url: data.signedUrl, contentType: RULE.types[extOf(name)] };
}

/** Step 2: check the file really is an image within 2 MB, save it as the photo, and remove older photos. */
export async function finishAvatarUpload(path: string): Promise<Result> {
  const m = await me();
  if (!m) return { ok: false, error: "Sign in to change your photo." };
  if (!new RegExp(`^${m.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return { ok: false, error: "Unknown upload." };
  const bucket = createServiceClient().storage.from("avatars");
  const { data: blob, error } = await bucket.download(path);
  if (error || !blob) return { ok: false, error: "The upload didn't arrive. Please try again." };
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (blob.size > RULE.maxBytes || !contentMatches(extOf(path), sniff(head))) {
    await bucket.remove([path]);
    return { ok: false, error: "That file isn't a JPG, PNG or WebP image under 2 MB." };
  }
  const url = bucket.getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await m.supabase.from("profiles").update({ avatar_url: url }).eq("id", m.id);
  if (saveError) return { ok: false, error: "Couldn't save your photo. Please try again." };
  await removeOthers(m.id, path);
  revalidatePath("/", "layout");
  return { ok: true, url };
}

export async function removeAvatar(): Promise<Result> {
  const m = await me();
  if (!m) return { ok: false, error: "Sign in to change your photo." };
  const { error } = await m.supabase.from("profiles").update({ avatar_url: null }).eq("id", m.id);
  if (error) return { ok: false, error: "Couldn't remove your photo. Please try again." };
  await removeOthers(m.id, null);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}

async function removeOthers(memberId: string, keep: string | null) {
  const bucket = createServiceClient().storage.from("avatars");
  const { data } = await bucket.list(memberId, { limit: 100 });
  const old = (data ?? []).map((f) => `${memberId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await bucket.remove(old);
}
