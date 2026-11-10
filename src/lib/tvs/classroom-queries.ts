import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type CModule = { id: string; cohort_id: string; position: number; title: string; summary: string; opens_at: string | null };
export type CStep = { id: string; module_id: string; position: number; title: string; kind: string; meta: string; url: string | null };
export type CAssignment = { id: string; module_id: string; title: string; brief: string; due_at: string | null };
export type CSubmission = {
  id: string;
  assignment_id: string;
  member_id: string;
  file_name: string;
  file_size: number;
  status: "submitted" | "reviewed";
  submitted_at: string;
  feedback: string | null;
  reviewed_at: string | null;
};
export type CSession = { id: string; cohort_id: string; title: string; starts_at: string; meet_url: string | null; recording_url: string | null; recording_note: string };
export type CFile = { id: string; cohort_id: string; module_id: string | null; title: string; note: string; file_name: string; file_size: number; created_at: string };
export type CPost = { id: string; member_id: string; body: string; is_host: boolean; removed_at: string | null; created_at: string; author: string };

export type Classroom = {
  cohort: { id: string; label: string; starts_on: string | null; program: string };
  modules: CModule[];
  steps: CStep[];
  assignments: CAssignment[];
  submissions: CSubmission[];
  sessions: CSession[];
  files: CFile[];
  posts: CPost[];
  done: Set<string>;
};

const MODULE_COLS = "id, cohort_id, position, title, summary, opens_at";
const STEP_COLS = "id, module_id, position, title, kind, meta, url";
const ASSIGNMENT_COLS = "id, module_id, title, brief, due_at";
const SUBMISSION_COLS = "id, assignment_id, member_id, file_name, file_size, status, submitted_at, feedback, reviewed_at";
const SESSION_COLS = "id, cohort_id, title, starts_at, meet_url, recording_url, recording_note";
const FILE_COLS = "id, cohort_id, module_id, title, note, file_name, file_size, created_at";

/** First names for discussion posts. Read with the service key only after the caller could already see the posts. */
async function authorNames(ids: string[]) {
  const uniq = Array.from(new Set(ids));
  if (!uniq.length) return new Map<string, string>();
  const { data } = await createServiceClient().from("profiles").select("id, full_name, role").in("id", uniq);
  return new Map(((data ?? []) as { id: string; full_name: string | null; role: string | null }[]).map((p) => [p.id, [p.full_name?.split(" ")[0] || "Member", p.role].filter(Boolean).join(" · ")]));
}

/** The cohorts the member is a confirmed learner in. */
export async function myClassrooms(): Promise<{ id: string; label: string; program: string }[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("enrolments").select("cohort_id, cohorts(label, programs(name))").eq("status", "confirmed");
  return ((data ?? []) as unknown as { cohort_id: string; cohorts: { label: string; programs: { name: string } | null } | null }[]).map((e) => ({
    id: e.cohort_id,
    label: e.cohorts?.label ?? "Cohort",
    program: e.cohorts?.programs?.name ?? "Program",
  }));
}

/**
 * Everything in one cohort, read with the caller's own session: row level security returns nothing
 * unless they are a confirmed learner in it (or an admin).
 */
export async function loadClassroom(cohortId: string, opts: { admin?: boolean } = {}): Promise<Classroom | null> {
  if (!supabaseConfigured || !/^[0-9a-f-]{36}$/.test(cohortId)) return null;
  const supabase = await createClient();
  const { data: c } = await supabase.from("cohorts").select("id, label, starts_on, programs(name)").eq("id", cohortId).maybeSingle();
  if (!c) return null;
  const { data: mods } = await supabase.from("modules").select(MODULE_COLS).eq("cohort_id", cohortId).order("position");
  const modules = (mods ?? []) as CModule[];
  const moduleIds = modules.map((m) => m.id);
  const none = Promise.resolve({ data: [] as unknown[] });
  const [steps, assignments, sessions, files, posts, progress] = await Promise.all([
    moduleIds.length ? supabase.from("module_steps").select(STEP_COLS).in("module_id", moduleIds).order("position") : none,
    moduleIds.length ? supabase.from("assignments").select(ASSIGNMENT_COLS).in("module_id", moduleIds).order("due_at", { nullsFirst: false }) : none,
    supabase.from("class_sessions").select(SESSION_COLS).eq("cohort_id", cohortId).order("starts_at"),
    supabase.from("cohort_files").select(FILE_COLS).eq("cohort_id", cohortId).order("created_at", { ascending: false }),
    supabase.from("cohort_posts").select("id, member_id, body, is_host, removed_at, created_at").eq("cohort_id", cohortId).order("created_at").limit(300),
    opts.admin ? none : supabase.from("step_progress").select("step_id"),
  ]);
  const assignmentRows = (assignments.data ?? []) as CAssignment[];
  const { data: subs } = assignmentRows.length
    ? await supabase.from("submissions").select(SUBMISSION_COLS).in("assignment_id", assignmentRows.map((a) => a.id))
    : { data: [] };
  const postRows = (posts.data ?? []) as Omit<CPost, "author">[];
  const names = await authorNames(postRows.map((p) => p.member_id));
  const cohort = c as unknown as { id: string; label: string; starts_on: string | null; programs: { name: string } | null };
  return {
    cohort: { id: cohort.id, label: cohort.label, starts_on: cohort.starts_on, program: cohort.programs?.name ?? "Program" },
    modules,
    steps: (steps.data ?? []) as CStep[],
    assignments: assignmentRows,
    submissions: (subs ?? []) as CSubmission[],
    sessions: (sessions.data ?? []) as CSession[],
    files: (files.data ?? []) as CFile[],
    posts: postRows.map((p) => ({ ...p, author: p.is_host ? `${names.get(p.member_id)?.split(" · ")[0] ?? "Host"} · Host` : names.get(p.member_id) ?? "Member" })),
    done: new Set(((progress.data ?? []) as { step_id: string }[]).map((p) => p.step_id)),
  };
}

/** Admin: each confirmed learner's progress in a cohort, plus last activity. */
export async function cohortLearnerProgress(cohortId: string) {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data: ens } = await supabase.from("enrolments").select("member_id").eq("cohort_id", cohortId).eq("status", "confirmed");
  const members = ((ens ?? []) as { member_id: string }[]).map((e) => e.member_id);
  if (!members.length) return [];
  const { data: mods } = await supabase.from("modules").select("id").eq("cohort_id", cohortId);
  const moduleIds = ((mods ?? []) as { id: string }[]).map((m) => m.id);
  const { data: steps } = moduleIds.length ? await supabase.from("module_steps").select("id").in("module_id", moduleIds) : { data: [] };
  const stepIds = ((steps ?? []) as { id: string }[]).map((s) => s.id);
  const { data: prog } = stepIds.length ? await supabase.from("step_progress").select("member_id, step_id, done_at").in("step_id", stepIds).in("member_id", members) : { data: [] };
  const rows = (prog ?? []) as { member_id: string; done_at: string }[];
  const names = await authorNames(members);
  return members.map((m) => {
    const mine = rows.filter((r) => r.member_id === m);
    const last = mine.map((r) => r.done_at).sort().at(-1) ?? null;
    return { member_id: m, name: names.get(m) ?? "Member", pct: stepIds.length ? Math.round((mine.length / stepIds.length) * 100) : 0, last };
  });
}
