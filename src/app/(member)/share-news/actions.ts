"use server";

import { revalidatePath } from "next/cache";
import { alertPartners } from "@/lib/email/brickr";
import { parseNews } from "@/lib/news/format";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkUpload, contentMatches, extOf, sniff, UPLOAD_RULES } from "@/lib/uploads";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function me() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { id: String(id), supabase } : null;
}

/** An image the member uploaded for their news: content-images/news/<member>/<uuid>.<ext>. */
const isNewsImage = (memberId: string) => (url: string) =>
  new RegExp(`^https://[a-z0-9-]+\\.supabase\\.co/storage/v1/object/public/content-images/news/${memberId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(url);

export async function startNewsImage(name: string, size: number): Promise<{ ok: true; path: string; url: string; contentType: string } | { ok: false; error: string }> {
  const m = await me();
  if (!m) return { ok: false, error: "Sign in to upload an image." };
  const bad = checkUpload("content-images", name, size);
  if (bad) return { ok: false, error: bad };
  const ext = extOf(name) === "jpeg" ? "jpg" : extOf(name);
  const path = `news/${m.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createServiceClient().storage.from("content-images").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Please try again." };
  return { ok: true, path, url: data.signedUrl, contentType: UPLOAD_RULES["content-images"].types[extOf(name)] };
}

/** Checks the uploaded file really is an image within 5 MB and returns its address. */
export async function finishNewsImage(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const m = await me();
  if (!m) return { ok: false, error: "Sign in to upload an image." };
  if (!new RegExp(`^news/${m.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return { ok: false, error: "Unknown upload." };
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

export async function submitNews(form: FormData): Promise<Result> {
  const m = await me();
  if (!m) return { ok: false, error: "Sign in to share your news." };
  const parsed = parseNews(form, isNewsImage(m.id));
  if (!parsed.ok) return parsed;
  const { error } = await m.supabase.from("news_submissions").insert({ ...parsed.value, member_id: m.id });
  if (error) {
    if (error.message.includes("too_many_submissions")) return { ok: false, error: "You've shared 5 news items today. Please try again tomorrow." };
    return { ok: false, error: "Couldn't send your news. Please try again." };
  }
  const v = parsed.value;
  await alertPartners(`Member news: ${v.headline}`, [`${v.contact_name} shared news about ${v.business_name} (${v.news_type}).`, v.summary, `Prefers: ${v.preferred}.`], "/requests?tab=news").catch(() => null);
  revalidatePath("/my-space");
  return { ok: true, message: "Thanks! We'll review your news and let you know." };
}
