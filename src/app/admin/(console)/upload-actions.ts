"use server";

import { audit, requireAdmin } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";
import { checkUpload, cleanFileName, contentMatches, extOf, sniff, UPLOAD_RULES, type UploadTarget } from "@/lib/uploads";

const TARGETS = Object.keys(UPLOAD_RULES) as UploadTarget[];
const PATH = /^(files\/)?\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

/**
 * Step 1: a one-time upload link for one file. The browser sends the file straight to storage,
 * so large files don't pass through the app server (which limits request size).
 */
export async function startUpload(
  target: UploadTarget,
  name: string,
  size: number,
): Promise<{ ok: true; path: string; url: string; contentType: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!TARGETS.includes(target)) return { ok: false, error: "Unknown upload." };
  const bad = checkUpload(target, name, size);
  if (bad) return { ok: false, error: bad };
  const ext = extOf(name) === "jpeg" ? "jpg" : extOf(name);
  const path = `${target === "cohort-files" ? "files/" : ""}${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createServiceClient().storage.from(target).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Please try again." };
  return { ok: true, path, url: data.signedUrl, contentType: UPLOAD_RULES[target].types[extOf(name)] };
}

/**
 * Step 2: check the uploaded file is what its name says (from its first bytes) and within the size limit.
 * Anything that fails is deleted. Returns the public address (images) or the storage path (Library files).
 */
export async function finishUpload(
  target: UploadTarget,
  path: string,
  originalName: string,
): Promise<{ ok: true; url: string | null; path: string; fileName: string; size: number } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (!TARGETS.includes(target) || !PATH.test(path)) return { ok: false, error: "Unknown upload." };
  const svc = createServiceClient();
  const bucket = svc.storage.from(target);
  const { data: blob, error } = await bucket.download(path);
  if (error || !blob) return { ok: false, error: "The upload didn't arrive. Please try again." };
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ext = extOf(path);
  if (blob.size > UPLOAD_RULES[target].maxBytes || !contentMatches(ext, sniff(head))) {
    await bucket.remove([path]);
    return { ok: false, error: UPLOAD_RULES[target].public ? "That file isn't a real JPG, PNG or WebP image." : "That file isn't a real PDF, Office or ZIP file." };
  }
  await audit(admin.userId, "upload", target, { entityId: path, after: { size: blob.size } });
  const url = UPLOAD_RULES[target].public ? bucket.getPublicUrl(path).data.publicUrl : null;
  return { ok: true, url, path, fileName: cleanFileName(originalName), size: blob.size };
}
