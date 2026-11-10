import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Person, Session } from "@/lib/details";
import type { ApplicationStatus, EnrolmentStatus, ProgramStatus } from "./format";

export type Program = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  weeks: string;
  price_piasters: number | null;
  requires_tvac: boolean;
  tags: string[];
  banner: string;
  banner_url: string | null;
  status: ProgramStatus;
  sort: number;
  short_description: string;
  details: string;
  audience: string;
  outline: Session[];
  prerequisites: string[];
  activities: string[];
  hosts: Person[];
  guests: Person[];
  brochure_url: string | null;
};
export const PROGRAM_COLS =
  "id, slug, name, kind, description, weeks, price_piasters, requires_tvac, tags, banner, banner_url, status, sort, short_description, details, audience, outline, prerequisites, activities, hosts, guests, brochure_url";

/** What members may see about a cohort (never the Meet link). */
export type PublicCohort = {
  id: string;
  program_id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  format: "Online" | "In person" | null;
  location: string | null;
  capacity: number | null;
  price_piasters: number | null;
  status: string;
  seats_left: number | null;
};

/** Upcoming and running cohorts per program, earliest first. Read on the server with only public columns. */
export async function publicCohorts(programIds: string[]): Promise<Map<string, PublicCohort[]>> {
  const out = new Map<string, PublicCohort[]>();
  if (!supabaseConfigured || !programIds.length) return out;
  const svc = createServiceClient();
  const [{ data }, { data: ens }] = await Promise.all([
    svc.from("cohorts").select("id, program_id, label, starts_on, ends_on, format, location, capacity, price_piasters, status").in("program_id", programIds).in("status", ["planned", "running"]),
    svc.from("enrolments").select("cohort_id").in("status", ["offered", "confirmed"]),
  ]);
  const taken = new Map<string, number>();
  for (const e of (ens ?? []) as { cohort_id: string }[]) taken.set(e.cohort_id, (taken.get(e.cohort_id) ?? 0) + 1);
  const rows = ((data ?? []) as Omit<PublicCohort, "seats_left">[])
    .map((c) => ({ ...c, seats_left: c.capacity == null ? null : Math.max(0, c.capacity - (taken.get(c.id) ?? 0)) }))
    .sort((a, b) => (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999"));
  for (const c of rows) out.set(c.program_id, [...(out.get(c.program_id) ?? []), c]);
  return out;
}

/** One program members can see, by its address. */
export async function getProgram(slug: string): Promise<Program | null> {
  if (!supabaseConfigured || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("programs").select(PROGRAM_COLS).eq("slug", slug).in("status", ["open", "in_development"]).maybeSingle();
  return (data as Program | null) ?? null;
}

export type MyApplication = { id: string; program_id: string; status: ApplicationStatus; created_at: string; programs: { name: string } | null };
export type MyEnrolment = {
  id: string;
  status: EnrolmentStatus;
  amount_piasters: number;
  pay_reference: string;
  offered_at: string;
  confirmed_at: string | null;
  cohorts: { label: string; starts_on: string | null; program_id: string; programs: { name: string } | null } | null;
};

const byFoundationFirst = (a: Program, b: Program) => (a.kind === "Foundation" ? -1 : 0) - (b.kind === "Foundation" ? -1 : 0) || a.sort - b.sort || a.name.localeCompare(b.name);

/** Programs members can see: open and in development, the foundation program first. */
export async function listPrograms(): Promise<Program[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("programs").select(PROGRAM_COLS).in("status", ["open", "in_development"]).limit(50);
  return ((data ?? []) as Program[]).sort(byFoundationFirst);
}

export async function myTvs(): Promise<{ applications: MyApplication[]; enrolments: MyEnrolment[]; interests: Set<string> }> {
  const empty = { applications: [], enrolments: [], interests: new Set<string>() };
  if (!supabaseConfigured) return empty;
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  if (!c?.claims?.sub) return empty;
  const [a, e, i] = await Promise.all([
    supabase.from("applications").select("id, program_id, status, created_at, programs(name)").order("created_at", { ascending: false }),
    supabase.from("enrolments").select("id, status, amount_piasters, pay_reference, offered_at, confirmed_at, cohorts(label, starts_on, program_id, programs(name))").order("offered_at", { ascending: false }),
    supabase.from("program_interest").select("program_id"),
  ]);
  return {
    applications: (a.data ?? []) as unknown as MyApplication[],
    enrolments: (e.data ?? []) as unknown as MyEnrolment[],
    interests: new Set(((i.data ?? []) as { program_id: string }[]).map((x) => x.program_id)),
  };
}

// ---------------------------------------------------------------- admin

export type AdminProgram = Program & { interested: { name: string; email: string | null; at: string }[] };
export type AdminApplication = {
  id: string;
  member_id: string;
  program_id: string;
  role: string;
  venture_stage: string;
  building: string;
  why_now: string;
  answers: { q: string; a: string }[];
  status: ApplicationStatus;
  owner: string | null;
  created_at: string;
  member: string;
  email: string | null;
  program: string;
  price_piasters: number | null;
};
export type Cohort = {
  id: string;
  program_id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  format: "Online" | "In person" | null;
  location: string | null;
  capacity: number | null;
  price_piasters: number | null;
  status: string;
  program: string;
  taken: number;
  meet_url: string | null;
};
export type AdminEnrolment = {
  id: string;
  member_id: string;
  cohort_id: string;
  status: EnrolmentStatus;
  amount_piasters: number;
  pay_reference: string;
  offered_at: string;
  confirmed_at: string | null;
  member: string;
  email: string | null;
  cohort: string;
  program: string;
};

/** Names from profiles and emails from auth, for the people in admin lists. */
export async function peopleById(ids: string[]): Promise<Map<string, { name: string; email: string | null }>> {
  const uniq = Array.from(new Set(ids));
  if (!uniq.length) return new Map();
  const svc = createServiceClient();
  const { data } = await svc.from("profiles").select("id, full_name").in("id", uniq);
  const names = new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const out = new Map<string, { name: string; email: string | null }>();
  await Promise.all(
    uniq.map(async (id) => {
      const { data: u } = await svc.auth.admin.getUserById(id);
      out.set(id, { name: names.get(id) || (u.user?.user_metadata?.name as string | undefined) || "Member", email: u.user?.email ?? null });
    }),
  );
  return out;
}

export async function adminPrograms(): Promise<AdminProgram[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: rows }, { data: interest }] = await Promise.all([
    supabase.from("programs").select(PROGRAM_COLS).limit(100),
    supabase.from("program_interest").select("program_id, member_id, created_at").order("created_at", { ascending: false }),
  ]);
  const ints = (interest ?? []) as { program_id: string; member_id: string; created_at: string }[];
  const people = await peopleById(ints.map((i) => i.member_id));
  return ((rows ?? []) as Program[]).sort(byFoundationFirst).map((p) => ({
    ...p,
    interested: ints.filter((i) => i.program_id === p.id).map((i) => ({ name: people.get(i.member_id)?.name ?? "Member", email: people.get(i.member_id)?.email ?? null, at: i.created_at })),
  }));
}

export async function adminApplications(): Promise<AdminApplication[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, member_id, program_id, role, venture_stage, building, why_now, answers, status, owner, created_at, programs(name, price_piasters)")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as unknown as (Omit<AdminApplication, "member" | "email" | "program" | "price_piasters"> & { programs: { name: string; price_piasters: number | null } | null })[];
  const people = await peopleById(rows.map((r) => r.member_id));
  return rows.map(({ programs, ...r }) => ({
    ...r,
    member: people.get(r.member_id)?.name ?? "Member",
    email: people.get(r.member_id)?.email ?? null,
    program: programs?.name ?? "Program",
    price_piasters: programs?.price_piasters ?? null,
  }));
}

export async function adminCohorts(): Promise<Cohort[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data }, { data: ens }] = await Promise.all([
    supabase.from("cohorts").select("id, program_id, label, starts_on, ends_on, format, location, capacity, price_piasters, status, programs(name), cohort_links(meet_url)").order("created_at", { ascending: false }),
    supabase.from("enrolments").select("cohort_id, status").in("status", ["offered", "confirmed"]),
  ]);
  const taken = new Map<string, number>();
  for (const e of (ens ?? []) as { cohort_id: string }[]) taken.set(e.cohort_id, (taken.get(e.cohort_id) ?? 0) + 1);
  type Row = Omit<Cohort, "program" | "taken" | "meet_url"> & { programs: { name: string } | null; cohort_links: { meet_url: string | null } | { meet_url: string | null }[] | null };
  return ((data ?? []) as unknown as Row[]).map(({ programs, cohort_links, ...c }) => ({
    ...c,
    program: programs?.name ?? "Program",
    taken: taken.get(c.id) ?? 0,
    meet_url: (Array.isArray(cohort_links) ? cohort_links[0]?.meet_url : cohort_links?.meet_url) ?? null,
  }));
}

export async function adminEnrolments(): Promise<AdminEnrolment[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrolments")
    .select("id, member_id, cohort_id, status, amount_piasters, pay_reference, offered_at, confirmed_at, cohorts(label, programs(name))")
    .order("offered_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as unknown as (Omit<AdminEnrolment, "member" | "email" | "cohort" | "program"> & { cohorts: { label: string; programs: { name: string } | null } | null })[];
  const people = await peopleById(rows.map((r) => r.member_id));
  return rows.map(({ cohorts, ...r }) => ({
    ...r,
    member: people.get(r.member_id)?.name ?? "Member",
    email: people.get(r.member_id)?.email ?? null,
    cohort: cohorts?.label ?? "Cohort",
    program: cohorts?.programs?.name ?? "Program",
  }));
}
