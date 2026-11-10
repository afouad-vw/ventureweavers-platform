import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/tvs/queries";
import type { ApplicationStatus } from "@/lib/tvs/format";

export type Service = {
  id: string;
  slug: string;
  name: string;
  space: "BRICKR" | "Outloud" | "TVS";
  audience: string;
  format: string;
  description: string;
  tags: string[];
  banner: string;
  banner_url: string | null;
  status: "draft" | "published";
  sort: number;
  short_description: string;
  offerings: string[];
  prerequisites: string[];
  brochure_url: string | null;
};
export const SERVICE_COLS = "id, slug, name, space, audience, format, description, tags, banner, banner_url, status, sort, short_description, offerings, prerequisites, brochure_url";

/** One published service, by its address. */
/** The hidden service behind TVS custom program requests. */
export async function customProgramService(): Promise<Service | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("services").select(SERVICE_COLS).eq("slug", "custom-program").eq("status", "published").maybeSingle();
  return (data as Service | null) ?? null;
}

export async function getService(slug: string): Promise<Service | null> {
  if (!supabaseConfigured || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("services").select(SERVICE_COLS).eq("slug", slug).eq("status", "published").maybeSingle();
  return (data as Service | null) ?? null;
}

export type MyRequest = {
  id: string;
  space: string;
  preferred_at: string;
  company: string;
  note: string;
  status: ApplicationStatus;
  meeting_at: string | null;
  meeting_url: string | null;
  created_at: string;
  services: { name: string } | null;
};

export type Stage = { id: string; position: number; name: string; description: string; progress: number };
export type LogEntry = { id: string; entry_date: string; title: string; body: string; status: "draft" | "published" };
export type MyWaitlist = { role: string; feedback_calls: boolean; invite_code: string; joined_at: string } | null;

const bySort = (a: Service, b: Service) => a.sort - b.sort || a.name.localeCompare(b.name);

export async function listServices(): Promise<Service[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  // TVS custom programs have a service row for Calendly requests; it isn't listed with BRICKR and Outloud services.
  const { data } = await supabase.from("services").select(SERVICE_COLS).eq("status", "published").neq("space", "TVS").limit(50);
  return ((data ?? []) as Service[]).sort(bySort);
}

export async function myRequests(): Promise<MyRequest[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("id, space, preferred_at, company, note, status, meeting_at, meeting_url, created_at, services(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as MyRequest[];
}

export async function qqStages(): Promise<Stage[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("qq_stages").select("id, position, name, description, progress").order("position");
  return (data ?? []) as Stage[];
}

export async function qqLog(all = false): Promise<LogEntry[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  let q = supabase.from("qq_log").select("id, entry_date, title, body, status").order("entry_date", { ascending: false }).limit(100);
  if (!all) q = q.eq("status", "published");
  const { data } = await q;
  return (data ?? []) as LogEntry[];
}

export async function myWaitlist(memberId: string): Promise<MyWaitlist> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("waitlist").select("role, feedback_calls, invite_code, joined_at").eq("member_id", memberId).maybeSingle();
  return (data as MyWaitlist) ?? null;
}

// ---------------------------------------------------------------- admin

export async function adminServices(): Promise<Service[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("services").select(SERVICE_COLS).limit(100);
  return ((data ?? []) as Service[]).sort(bySort);
}

export type InboxItem = {
  kind: "request" | "application";
  id: string;
  title: string;
  space: "BRICKR" | "Outloud" | "TVS";
  member: string;
  email: string | null;
  company: string;
  note: string;
  timing: string | null;
  meeting_at: string | null;
  meeting_url: string | null;
  owner: string | null;
  status: ApplicationStatus;
  created_at: string;
  notes: { id: string; body: string; created_at: string; author: string }[];
};

/** Every meeting request and TVS application, newest first, with partner notes on requests. */
export async function adminInbox(): Promise<InboxItem[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: reqs }, { data: apps }, { data: notes }] = await Promise.all([
    supabase.from("requests").select("id, member_id, space, preferred_at, company, note, status, owner, meeting_at, meeting_url, created_at, services(name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("applications").select("id, member_id, role, venture_stage, building, status, owner, created_at, programs(name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("request_notes").select("id, request_id, author_id, body, created_at").order("created_at"),
  ]);
  type R = { id: string; member_id: string; space: "BRICKR" | "Outloud"; preferred_at: string; company: string; note: string; status: ApplicationStatus; owner: string | null; meeting_at: string | null; meeting_url: string | null; created_at: string; services: { name: string } | null };
  type A = { id: string; member_id: string; role: string; venture_stage: string; building: string; status: ApplicationStatus; owner: string | null; created_at: string; programs: { name: string } | null };
  type N = { id: string; request_id: string; author_id: string; body: string; created_at: string };
  const r = (reqs ?? []) as unknown as R[];
  const a = (apps ?? []) as unknown as A[];
  const n = (notes ?? []) as N[];
  const people = await peopleById([...r.map((x) => x.member_id), ...a.map((x) => x.member_id), ...n.map((x) => x.author_id)]);
  const items: InboxItem[] = [
    ...r.map((x) => ({
      kind: "request" as const,
      id: x.id,
      title: x.services?.name ?? "Request",
      space: x.space,
      member: people.get(x.member_id)?.name ?? "Member",
      email: people.get(x.member_id)?.email ?? null,
      company: x.company,
      note: x.note,
      timing: x.preferred_at,
      meeting_at: x.meeting_at,
      meeting_url: x.meeting_url,
      owner: x.owner,
      status: x.status,
      created_at: x.created_at,
      notes: n.filter((y) => y.request_id === x.id).map((y) => ({ id: y.id, body: y.body, created_at: y.created_at, author: people.get(y.author_id)?.name ?? "Partner" })),
    })),
    ...a.map((x) => ({
      kind: "application" as const,
      id: x.id,
      title: `${x.programs?.name ?? "Program"} application`,
      space: "TVS" as const,
      member: people.get(x.member_id)?.name ?? "Member",
      email: people.get(x.member_id)?.email ?? null,
      company: [x.role, x.venture_stage].filter(Boolean).join(" · "),
      note: x.building,
      timing: null,
      meeting_at: null,
      meeting_url: null,
      owner: x.owner,
      status: x.status,
      created_at: x.created_at,
      notes: [],
    })),
  ];
  return items.sort((p, q) => q.created_at.localeCompare(p.created_at));
}

export type WaitlistRow = { id: string; name: string; email: string | null; role: string; feedback_calls: boolean; invited_by: string | null; joined_at: string; member: boolean };

export async function adminWaitlist(): Promise<WaitlistRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("waitlist").select("id, member_id, name, email, role, feedback_calls, invited_by, joined_at").order("joined_at", { ascending: false }).limit(5000);
  const rows = (data ?? []) as { id: string; member_id: string | null; name: string | null; email: string | null; role: string; feedback_calls: boolean; invited_by: string | null; joined_at: string }[];
  const people = await peopleById(rows.map((x) => x.member_id).filter(Boolean) as string[]);
  const named = new Map(rows.map((x) => [x.id, (x.member_id && people.get(x.member_id)?.name) || x.name || x.email || "Member"]));
  return rows.map((x) => ({
    id: x.id,
    name: named.get(x.id)!,
    email: (x.member_id && people.get(x.member_id)?.email) || x.email,
    role: x.role,
    feedback_calls: x.feedback_calls,
    invited_by: x.invited_by ? named.get(x.invited_by) ?? null : null,
    joined_at: x.joined_at,
    member: Boolean(x.member_id),
  }));
}
