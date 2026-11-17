import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/tvs/queries";
import type { Currency, Health, MeetingKind, ProjectKind, ProjectRole, ProjectStatus, RequestStatus } from "./format";

export type Project = {
  id: string;
  slug: string;
  name: string;
  kind: ProjectKind;
  parent_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  service: string;
  status: ProjectStatus;
  health: Health;
  summary: string;
  goals: string[];
  dimensions: string[];
  starts_on: string | null;
  term_months: number | null;
  retainer_amount: number | null;
  currency: Currency;
  billing: string;
  cadence: string;
  key_terms: string;
  proposal_path: string | null;
  proposal_name: string | null;
  proposal_accepted_at: string | null;
  proposal_accepted_by: string | null;
  drive_url: string | null;
  calendly_url: string | null;
  created_at: string;
};
export const PROJECT_COLS =
  "id, slug, name, kind, parent_id, company_id, deal_id, service, status, health, summary, goals, dimensions, starts_on, term_months, retainer_amount, currency, billing, cadence, key_terms, proposal_path, proposal_name, proposal_accepted_at, proposal_accepted_by, drive_url, calendly_url, created_at";

export type ProjectPerson = { id: string; member_id: string | null; email: string | null; name: string; role: ProjectRole; project_id: string };
export type ScopeItem = { id: string; dimension: string; title: string; details: string; outputs: string[]; sort: number };
export type ProjectRequest = {
  id: string;
  project_id: string;
  title: string;
  details: string;
  source: "client" | "team";
  received_note: string;
  raised_by: string | null;
  raised_by_name: string;
  status: RequestStatus;
  price: number | null;
  currency: Currency;
  response: string;
  requirements: string;
  timeline: string;
  decline_reason: string;
  responded_at: string | null;
  decided_at: string | null;
  decided_by_name: string | null;
  created_at: string;
};
export type ProjectComment = { id: string; target_type: string; target_id: string | null; body: string; internal: boolean; author_id: string; author: string; staff: boolean; created_at: string };
export type ProjectMeeting = { id: string; project_id: string; title: string; kind: MeetingKind; starts_at: string; minutes: number; meet_url: string | null; agenda: string; notes: string; status: "scheduled" | "done" | "cancelled"; source: string };
export type ProjectNote = { id: string; body: string; pinned: boolean; author: string; created_at: string };

export type ProjectView = {
  project: Project;
  parent: Pick<Project, "id" | "slug" | "name"> | null;
  children: Pick<Project, "id" | "slug" | "name" | "status" | "health">[];
  company: { id: string; name: string } | null;
  people: ProjectPerson[];
  scope: ScopeItem[];
  requests: ProjectRequest[];
  comments: ProjectComment[];
  meetings: ProjectMeeting[];
  acceptedBy: string | null;
};

const REQ_COLS = "id, project_id, title, details, source, received_note, raised_by, status, price, currency, response, requirements, timeline, decline_reason, responded_at, decided_at, decided_by, created_at";

/** Everything on one project page. Row level security decides what's returned (no internal items for clients). */
async function loadView(match: { slug?: string; id?: string }, opts: { staff: boolean }): Promise<ProjectView | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  let q = supabase.from("projects").select(PROJECT_COLS);
  q = match.id ? q.eq("id", match.id) : q.eq("slug", match.slug ?? "");
  const { data: p } = await q.maybeSingle();
  if (!p) return null;
  const project = p as unknown as Project;
  // A venture's page also shows the portfolio's people; a portfolio's page also shows its ventures' requests and meetings.
  const [parent, children] = await Promise.all([
    project.parent_id ? supabase.from("projects").select("id, slug, name").eq("id", project.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    project.kind === "portfolio" ? supabase.from("projects").select("id, slug, name, status, health").eq("parent_id", project.id).order("name") : Promise.resolve({ data: [] }),
  ]);
  const kids = (children.data ?? []) as ProjectView["children"];
  const scopeIds = [project.id, ...kids.map((k) => k.id)];
  const peopleIds = [project.id, ...(project.parent_id ? [project.parent_id] : [])];
  const [people, scope, reqs, comments, meetings, company] = await Promise.all([
    supabase.from("project_members").select("id, member_id, email, name, role, project_id").in("project_id", peopleIds).order("created_at"),
    supabase.from("project_scope_items").select("id, dimension, title, details, outputs, sort").eq("project_id", project.id).order("sort").order("created_at"),
    supabase.from("project_requests").select(REQ_COLS).in("project_id", scopeIds).order("created_at", { ascending: false }).limit(300),
    supabase.from("project_comments").select("id, target_type, target_id, body, internal, author_id, created_at").in("project_id", scopeIds).order("created_at").limit(1000),
    supabase.from("project_meetings").select("id, project_id, title, kind, starts_at, minutes, meet_url, agenda, notes, status, source").in("project_id", scopeIds).order("starts_at", { ascending: true }).limit(300),
    opts.staff && project.company_id ? supabase.from("companies").select("id, name").eq("id", project.company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reqRows = (reqs.data ?? []) as (Omit<ProjectRequest, "raised_by_name" | "decided_by_name"> & { decided_by: string | null })[];
  const commentRows = (comments.data ?? []) as Omit<ProjectComment, "author" | "staff">[];
  const personRows = (people.data ?? []) as (Omit<ProjectPerson, "name"> & { name: string | null })[];
  const ids = [
    ...reqRows.flatMap((r) => [r.raised_by, r.decided_by]),
    ...commentRows.map((c) => c.author_id),
    ...personRows.map((m) => m.member_id),
    project.proposal_accepted_by,
  ].filter(Boolean) as string[];
  const names = await peopleById(ids);
  // Staff authors show as "VentureWeavers" to clients; client authors by name.
  const clientIds = new Set(personRows.map((m) => m.member_id).filter(Boolean) as string[]);
  const nameOf = (id: string | null) => (id ? names.get(id)?.name ?? "Member" : "");
  return {
    project,
    parent: (parent.data as ProjectView["parent"]) ?? null,
    children: kids,
    company: (company.data as ProjectView["company"]) ?? null,
    people: personRows.map((m) => ({ ...m, name: m.member_id ? names.get(m.member_id)?.name ?? m.name ?? "Member" : m.name ?? m.email ?? "Invited" })),
    scope: (scope.data ?? []) as ScopeItem[],
    requests: reqRows.map(({ decided_by, ...r }) => ({
      ...r,
      price: r.price === null ? null : Number(r.price),
      raised_by_name: r.raised_by && !clientIds.has(r.raised_by) && !opts.staff ? "VentureWeavers" : nameOf(r.raised_by),
      decided_by_name: decided_by ? nameOf(decided_by) : null,
    })),
    comments: commentRows.map((c) => {
      const staff = !clientIds.has(c.author_id);
      return { ...c, staff, author: staff && !opts.staff ? "VentureWeavers" : nameOf(c.author_id) };
    }),
    meetings: (meetings.data ?? []) as ProjectMeeting[],
    acceptedBy: project.proposal_accepted_by ? nameOf(project.proposal_accepted_by) : null,
  };
}

/** A member's project page (by address). Null when it doesn't exist or isn't theirs. */
export async function memberProject(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const view = await loadView({ slug }, { staff: false });
  if (!view) return null;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("project_role", { p_project: view.project.id });
  return role ? { ...view, role: role as ProjectRole } : null;
}

/** The staff view of one project (with partner notes). */
export async function adminProject(id: string): Promise<(ProjectView & { notes: ProjectNote[] }) | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const view = await loadView({ id }, { staff: true });
  if (!view) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("project_notes").select("id, body, pinned, author_id, created_at").eq("project_id", id).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: string; body: string; pinned: boolean; author_id: string; created_at: string }[];
  const names = await peopleById(rows.map((r) => r.author_id));
  return { ...view, notes: rows.map((r) => ({ id: r.id, body: r.body, pinned: r.pinned, created_at: r.created_at, author: names.get(r.author_id)?.name ?? "Partner" })) };
}

export type ProjectCard = Pick<Project, "id" | "slug" | "name" | "kind" | "parent_id" | "status" | "health" | "service" | "summary" | "currency" | "retainer_amount" | "term_months" | "starts_on" | "company_id"> & {
  openRequests: number;
  nextMeeting: string | null;
};

async function cards(rows: ProjectCard[]): Promise<ProjectCard[]> {
  if (!rows.length) return rows;
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);
  const [reqs, meets] = await Promise.all([
    supabase.from("project_requests").select("project_id, status").in("project_id", ids).in("status", ["submitted", "in_review", "quoted", "approved", "in_progress"]),
    supabase.from("project_meetings").select("project_id, starts_at").in("project_id", ids).eq("status", "scheduled").gte("starts_at", new Date().toISOString()).order("starts_at"),
  ]);
  const open = new Map<string, number>();
  for (const r of (reqs.data ?? []) as { project_id: string }[]) open.set(r.project_id, (open.get(r.project_id) ?? 0) + 1);
  const next = new Map<string, string>();
  for (const m of (meets.data ?? []) as { project_id: string; starts_at: string }[]) if (!next.has(m.project_id)) next.set(m.project_id, m.starts_at);
  return rows.map((r) => ({ ...r, openRequests: open.get(r.id) ?? 0, nextMeeting: next.get(r.id) ?? null }));
}
const CARD_COLS = "id, slug, name, kind, parent_id, status, health, service, summary, currency, retainer_amount, term_months, starts_on, company_id";

/** The signed-in member's projects (portfolios first, their ventures after). */
export async function myProjects(): Promise<ProjectCard[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select(CARD_COLS).neq("status", "cancelled").order("kind").order("name").limit(100);
  return cards((data ?? []) as unknown as ProjectCard[]);
}

/** All projects, for Admin › Projects. */
export async function adminProjects(): Promise<(ProjectCard & { company: string | null })[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select(`${CARD_COLS}, companies(name)`).order("name").limit(500);
  const rows = (data ?? []) as unknown as (ProjectCard & { companies: { name: string } | null })[];
  const withCounts = await cards(rows.map(({ companies, ...r }) => ({ ...r, company: companies?.name ?? null }) as ProjectCard & { company: string | null }));
  return withCounts as (ProjectCard & { company: string | null })[];
}
