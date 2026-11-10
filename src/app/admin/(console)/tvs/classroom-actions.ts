"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { emailFrame, esc, sendEmail } from "@/lib/email/send";
import { cairoLocalToISO } from "@/lib/events/format";
import { cleanLink } from "@/lib/content/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
const STEP_KINDS = ["reading", "case", "assignment", "library", "video", "task"];

function refresh() {
  revalidatePath("/admin/tvs", "layout");
  revalidatePath("/tvs/classroom");
}
const field = (form: FormData) => (k: string) => String(form.get(k) ?? "").trim();
const cairo = (v: string, time = "00:00") => (v ? cairoLocalToISO(v.includes("T") ? v : `${v}T${time}`) : null);

async function write(table: string, id: string | null, row: Record<string, unknown>, noun: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  if (id) {
    if (!ID.test(id)) return { ok: false, error: "Unknown item." };
    const { error } = await supabase.from(table).update(row).eq("id", id);
    if (error) return { ok: false, error: error.message.includes("check") ? "Some details aren't allowed. Check links and lengths." : "Couldn't save." };
    await audit(admin.userId, `${table}.update`, table, { entityId: id, after: row });
  } else {
    const { data, error } = await supabase.from(table).insert(row).select("id").single();
    if (error || !data) return { ok: false, error: error?.message.includes("check") ? "Some details aren't allowed. Check links and lengths." : "Couldn't create it." };
    await audit(admin.userId, `${table}.create`, table, { entityId: data.id, after: row });
  }
  refresh();
  return { ok: true, message: id ? `${noun} saved` : `${noun} added` };
}

async function remove(table: string, id: string, noun: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, `${table}.delete`, table, { entityId: id });
  refresh();
  return { ok: true, message: `${noun} deleted` };
}

// ---------------------------------------------------------------- modules and steps

export async function saveModule(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  if (!ID.test(s("cohort_id"))) return { ok: false, error: "Choose a cohort." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  const position = Number(s("position") || 1);
  if (!Number.isInteger(position) || position < 1 || position > 100) return { ok: false, error: "Order must be a whole number from 1." };
  let opens_at: string | null;
  try {
    opens_at = cairo(s("opens_on"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return write("modules", s("id") || null, { cohort_id: s("cohort_id"), title: s("title").slice(0, 120), position, summary: s("summary").slice(0, 1000), opens_at }, "Module");
}
export async function deleteModule(id: string) { return remove("modules", id, "Module"); }

export async function saveStep(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  if (!ID.test(s("module_id"))) return { ok: false, error: "Choose a module." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  const url = cleanLink(s("url"));
  if (url === "invalid") return { ok: false, error: "The link must be a page in the app (starting with /) or an https:// address." };
  const position = Number(s("position") || 1);
  return write("module_steps", s("id") || null, {
    module_id: s("module_id"),
    title: s("title").slice(0, 160),
    kind: STEP_KINDS.includes(s("kind")) ? s("kind") : "reading",
    meta: s("meta").slice(0, 60),
    url,
    position: Number.isInteger(position) ? Math.max(1, Math.min(100, position)) : 1,
  }, "Step");
}
export async function deleteStep(id: string) { return remove("module_steps", id, "Step"); }

/** Copy modules, steps and assignments from one cohort to another (dates left empty to set again). */
export async function copyCurriculum(fromCohort: string, toCohort: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(fromCohort) || !ID.test(toCohort) || fromCohort === toCohort) return { ok: false, error: "Choose another cohort to copy from." };
  const supabase = await createClient();
  const { data: mods } = await supabase.from("modules").select("id, position, title, summary").eq("cohort_id", fromCohort).order("position");
  if (!mods?.length) return { ok: false, error: "That cohort has no modules yet." };
  for (const m of mods) {
    const { data: made } = await supabase.from("modules").insert({ cohort_id: toCohort, position: m.position, title: m.title, summary: m.summary, opens_at: null }).select("id").single();
    if (!made) return { ok: false, error: "Copy stopped part-way. Check the modules and try again." };
    const [{ data: steps }, { data: work }] = await Promise.all([
      supabase.from("module_steps").select("position, title, kind, meta, url").eq("module_id", m.id),
      supabase.from("assignments").select("title, brief").eq("module_id", m.id),
    ]);
    if (steps?.length) await supabase.from("module_steps").insert(steps.map((x) => ({ ...x, module_id: made.id })));
    if (work?.length) await supabase.from("assignments").insert(work.map((x) => ({ ...x, module_id: made.id, due_at: null })));
  }
  await audit(admin.userId, "classroom.copy", "cohorts", { entityId: toCohort, after: { from: fromCohort, modules: mods.length } });
  refresh();
  return { ok: true, message: `Copied ${mods.length} modules. Set their opening dates and due dates.` };
}

// ---------------------------------------------------------------- assignments and review

export async function saveAssignment(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  if (!ID.test(s("module_id"))) return { ok: false, error: "Choose a module." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  let due_at: string | null;
  try {
    due_at = cairo(s("due_at"), "23:59");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return write("assignments", s("id") || null, { module_id: s("module_id"), title: s("title").slice(0, 160), brief: s("brief").slice(0, 2000), due_at }, "Assignment");
}
export async function deleteAssignment(id: string) { return remove("assignments", id, "Assignment"); }

export async function reviewSubmission(id: string, feedback: string): Promise<ActionResult> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown submission." };
  if (feedback.trim().length < 2) return { ok: false, error: "Write some feedback first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_submission", { p_submission: id, p_feedback: feedback.trim() });
  if (error) return { ok: false, error: "Couldn't save the review." };
  const { data } = await supabase.from("submissions").select("member_id, assignments(title)").eq("id", id).maybeSingle();
  const row = data as unknown as { member_id: string; assignments: { title: string } | null } | null;
  if (row) {
    const { data: u } = await createServiceClient().auth.admin.getUserById(row.member_id);
    if (u.user?.email) {
      const title = row.assignments?.title ?? "your assignment";
      await sendEmail(u.user.email, `Feedback on ${title}`, emailFrame("Your work is reviewed", [`Fouad &amp; Karim left feedback on <b>${esc(title)}</b>.`], { label: "Read the feedback", href: `${APP}/tvs/classroom?tab=assignments` })).catch(() => null);
    }
  }
  refresh();
  return { ok: true, message: "Reviewed; the learner gets an email" };
}

export async function reopenSubmission(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown submission." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reopen_submission", { p_submission: id });
  if (error) return { ok: false, error: "Couldn't reopen it." };
  refresh();
  return { ok: true, message: "Reopened; the learner can hand in again" };
}

export async function openSubmissionAdmin(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown submission." };
  const supabase = await createClient();
  const { data } = await supabase.from("submissions").select("file_path, file_name").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That file isn't available." };
  const { data: s } = await createServiceClient().storage.from("cohort-files").createSignedUrl(data.file_path, 300, { download: data.file_name || true });
  return s?.signedUrl ? { ok: true, url: s.signedUrl } : { ok: false, error: "Couldn't prepare the download." };
}

// ---------------------------------------------------------------- live sessions

export async function saveSession(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  if (!ID.test(s("cohort_id"))) return { ok: false, error: "Choose a cohort." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  const https = (v: string) => !v || /^https:\/\/[^\s<>"]+$/.test(v);
  if (!https(s("meet_url")) || !https(s("recording_url"))) return { ok: false, error: "Links must start with https://" };
  let starts_at: string | null;
  try {
    starts_at = cairo(s("starts_at"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!starts_at) return { ok: false, error: "Choose a date and time." };
  return write("class_sessions", s("id") || null, {
    cohort_id: s("cohort_id"),
    title: s("title").slice(0, 160),
    starts_at,
    meet_url: s("meet_url") || null,
    recording_url: s("recording_url") || null,
    recording_note: s("recording_note").slice(0, 40),
  }, "Session");
}
export async function deleteSession(id: string) { return remove("class_sessions", id, "Session"); }

// ---------------------------------------------------------------- documents

export async function saveCohortFile(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  if (!ID.test(s("cohort_id"))) return { ok: false, error: "Choose a cohort." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  const id = s("id") || null;
  const base = { cohort_id: s("cohort_id"), title: s("title").slice(0, 160), note: s("note").slice(0, 80), module_id: ID.test(s("module_id")) ? s("module_id") : null };
  if (id) return write("cohort_files", id, base, "Document");
  if (!/^files\/\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(s("file_path"))) return { ok: false, error: "Upload the file first." };
  return write("cohort_files", null, { ...base, file_path: s("file_path"), file_name: s("file_name").slice(0, 200) || "file", file_size: Number(s("file_size")) || 1 }, "Document");
}

export async function deleteCohortFile(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown document." };
  const supabase = await createClient();
  const { data } = await supabase.from("cohort_files").select("file_path").eq("id", id).maybeSingle();
  const r = await remove("cohort_files", id, "Document");
  if (r.ok && data?.file_path) await createServiceClient().storage.from("cohort-files").remove([data.file_path]);
  return r;
}

export async function openCohortFileAdmin(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown document." };
  const supabase = await createClient();
  const { data } = await supabase.from("cohort_files").select("file_path, file_name").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That file isn't available." };
  const { data: s } = await createServiceClient().storage.from("cohort-files").createSignedUrl(data.file_path, 300, { download: data.file_name || true });
  return s?.signedUrl ? { ok: true, url: s.signedUrl } : { ok: false, error: "Couldn't prepare the download." };
}

// ---------------------------------------------------------------- discussion

export async function setPostHidden(id: string, hidden: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown post." };
  const supabase = await createClient();
  const { error } = await supabase.from("cohort_posts").update({ removed_at: hidden ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the post." };
  await audit(admin.userId, hidden ? "post.hide" : "post.restore", "cohort_posts", { entityId: id });
  refresh();
  return { ok: true, message: hidden ? "Hidden from learners" : "Visible again" };
}
