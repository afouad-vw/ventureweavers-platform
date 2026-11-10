import { finishUpload, startUpload } from "@/app/admin/(console)/upload-actions";
import { supabasePublicKey } from "@/lib/supabase/env";
import { checkUpload, type UploadTarget } from "@/lib/uploads";

export type Uploaded = { url: string | null; path: string; fileName: string; size: number };

/** Send a file to a one-time Supabase Storage upload link. */
export async function putSigned(url: string, contentType: string, file: File): Promise<boolean> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "content-type": contentType, "x-upsert": "false", "cache-control": "max-age=31536000", apikey: supabasePublicKey },
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Admin uploads: a one-time link from the server, the file straight to storage, then the server checks it. */
export async function uploadFile(target: UploadTarget, file: File): Promise<{ ok: true; file: Uploaded } | { ok: false; error: string }> {
  const bad = checkUpload(target, file.name, file.size);
  if (bad) return { ok: false, error: bad };
  const s = await startUpload(target, file.name, file.size);
  if (!s.ok) return s;
  if (!(await putSigned(s.url, s.contentType, file))) return { ok: false, error: "The upload didn't go through. Check your connection and try again." };
  const f = await finishUpload(target, s.path, file.name);
  return f.ok ? { ok: true, file: { url: f.url, path: f.path, fileName: f.fileName, size: f.size } } : f;
}
