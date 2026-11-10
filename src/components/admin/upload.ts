"use client";

import { finishUpload, startUpload } from "@/app/admin/(console)/upload-actions";
import { supabasePublicKey } from "@/lib/supabase/env";
import { checkUpload, type UploadTarget } from "@/lib/uploads";

export type Uploaded = { url: string | null; path: string; fileName: string; size: number };

/** Upload one file straight to storage through a one-time link, then have the server check it. */
export async function uploadFile(target: UploadTarget, file: File): Promise<{ ok: true; file: Uploaded } | { ok: false; error: string }> {
  const bad = checkUpload(target, file.name, file.size);
  if (bad) return { ok: false, error: bad };
  const s = await startUpload(target, file.name, file.size);
  if (!s.ok) return s;
  const res = await fetch(s.url, {
    method: "PUT",
    body: file,
    headers: { "content-type": s.contentType, "x-upsert": "false", "cache-control": "max-age=31536000", apikey: supabasePublicKey },
  }).catch(() => null);
  if (!res || !res.ok) return { ok: false, error: "The upload didn't go through. Check your connection and try again." };
  const f = await finishUpload(target, s.path, file.name);
  return f.ok ? { ok: true, file: { url: f.url, path: f.path, fileName: f.fileName, size: f.size } } : f;
}
