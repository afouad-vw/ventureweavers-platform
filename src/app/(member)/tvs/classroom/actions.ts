"use server";

import { revalidatePath } from "next/cache";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkUpload, cleanFileName, contentMatches, extOf, sniff, UPLOAD_RULES } from "@/lib/uploads";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUCKET = "cohort-files";

async function learner() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub as string | undefined;
  return sub ? { supabase, id: sub } : null;
}

/** Tick or untick a step. The database refuses steps in locked modules or other cohorts. */
export async function toggleStep(stepId: string, done: boolean): Promise<Result> {
  if (!ID.test(stepId)) return { ok: false, error: "Unknown step." };
  const s = await learner();
  if (!s) return { ok: false, error: "Sign in again." };
  const { error } = done
    ? await s.supabase.from("step_progress").upsert({ step_id: stepId }, { onConflict: "member_id,step_id", ignoreDuplicates: true })
    : await s.supabase.from("step_progress").delete().eq("step_id", stepId);
  if (error) return { ok: false, error: error.message.includes("module_locked") ? "This module isn't open yet." : "Couldn't save your progress." };
  revalidatePath("/tvs/classroom");
  return { ok: true };
}

/** Step 1 of handing in work: a one-time upload link into the learner's own folder. */
export async function startSubmission(assignmentId: string, name: string, size: number): Promise<{ ok: true; path: string; url: string; contentType: string } | { ok: false; error: string }> {
  if (!ID.test(assignmentId)) return { ok: false, error: "Unknown assignment." };
  const s = await learner();
  if (!s) return { ok: false, error: "Sign in again." };
  const bad = checkUpload(BUCKET, name, size);
  if (bad) return { ok: false, error: bad };
  const { data: can } = await s.supabase.rpc("can_submit", { p_assignment: assignmentId });
  if (!can) return { ok: false, error: "This assignment isn't open for hand-ins." };
  const path = `submissions/${s.id}/${crypto.randomUUID()}.${extOf(name)}`;
  const { data, error } = await createServiceClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Please try again." };
  return { ok: true, path, url: data.signedUrl, contentType: UPLOAD_RULES[BUCKET].types[extOf(name)] };
}

/** Step 2: check the file is what it says, record the hand-in, and remove a replaced file. */
export async function finishSubmission(assignmentId: string, path: string, originalName: string): Promise<Result> {
  const s = await learner();
  if (!s || !ID.test(assignmentId)) return { ok: false, error: "Sign in again." };
  if (!new RegExp(`^submissions/${s.id}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`).test(path)) return { ok: false, error: "Unknown upload." };
  const bucket = createServiceClient().storage.from(BUCKET);
  const { data: blob } = await bucket.download(path);
  if (!blob) return { ok: false, error: "The upload didn't arrive. Please try again." };
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (blob.size > UPLOAD_RULES[BUCKET].maxBytes || !contentMatches(extOf(path), sniff(head))) {
    await bucket.remove([path]);
    return { ok: false, error: "That file isn't a real PDF, Office or ZIP file." };
  }
  const { data: old, error } = await s.supabase.rpc("submit_assignment", { p_assignment: assignmentId, p_path: path, p_name: cleanFileName(originalName), p_size: blob.size });
  if (error) {
    await bucket.remove([path]);
    return { ok: false, error: error.message.includes("cannot_submit") ? "This assignment can't take hand-ins any more." : "Couldn't record your hand-in." };
  }
  if (typeof old === "string" && old) await bucket.remove([old]);
  revalidatePath("/tvs/classroom");
  return { ok: true, message: "Handed in. Feedback from the partners within the week." };
}

async function signed(path: string, name: string) {
  const { data } = await createServiceClient().storage.from(BUCKET).createSignedUrl(path, 300, { download: name || true });
  return data?.signedUrl ?? null;
}

/** A 5-minute download link for a cohort document, after row level security confirms access. */
export async function openCohortFile(fileId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ID.test(fileId)) return { ok: false, error: "Unknown file." };
  const s = await learner();
  if (!s) return { ok: false, error: "Sign in again." };
  const { data } = await s.supabase.from("cohort_files").select("file_path, file_name").eq("id", fileId).maybeSingle();
  if (!data) return { ok: false, error: "That file isn't available." };
  const url = await signed(data.file_path, data.file_name);
  return url ? { ok: true, url } : { ok: false, error: "Couldn't prepare the download." };
}

/** The learner's own hand-in (admins may open anyone's). */
export async function openSubmission(submissionId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ID.test(submissionId)) return { ok: false, error: "Unknown file." };
  const s = await learner();
  if (!s) return { ok: false, error: "Sign in again." };
  const { data } = await s.supabase.from("submissions").select("file_path, file_name").eq("id", submissionId).maybeSingle();
  if (!data) return { ok: false, error: "That file isn't available." };
  const url = await signed(data.file_path, data.file_name);
  return url ? { ok: true, url } : { ok: false, error: "Couldn't prepare the download." };
}

export async function postToCohort(cohortId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!ID.test(cohortId)) return { ok: false, error: "Unknown cohort." };
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };
  const s = await learner();
  if (!s) return { ok: false, error: "Sign in again." };
  const { error } = await s.supabase.from("cohort_posts").insert({ cohort_id: cohortId, body: text });
  if (error) return { ok: false, error: error.message.includes("post_limit") ? "That's a lot of posts today. Try again tomorrow." : "Couldn't post. Please try again." };
  revalidatePath("/tvs/classroom");
  revalidatePath("/admin/tvs", "layout");
  return { ok: true, message: "Posted" };
}

export async function deleteMyPost(postId: string): Promise<Result> {
  if (!ID.test(postId)) return { ok: false, error: "Unknown post." };
  const s = await learner();
  if (!s) return { ok: false, error: "Sign in again." };
  const { error } = await s.supabase.from("cohort_posts").delete().eq("id", postId).eq("member_id", s.id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  revalidatePath("/tvs/classroom");
  return { ok: true, message: "Post deleted" };
}
