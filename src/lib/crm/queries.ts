import "server-only";
import { loadPeople, type Contact, type ContactItem } from "@/lib/contacts/queries";
import { slugOf } from "@/lib/contacts/slug";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { domainOf, isOpen, nameKey } from "./format";

export type Company = {
  id: string;
  name: string;
  type: string | null;
  stage: string | null;
  website: string | null;
  linkedin: string | null;
  country: string | null;
  tags: string[];
  notes: string;
  owner: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};
export const COMPANY_COLS = "id, name, type, stage, website, linkedin, country, tags, notes, owner, status, created_at, updated_at";

export type Deal = {
  id: string;
  company_id: string;
  title: string;
  type: string;
  stage: string;
  value: number | null;
  currency: string;
  expected_close: string | null;
  owner: string | null;
  service_id: string | null;
  program_id: string | null;
  notes: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
export const DEAL_COLS = "id, company_id, title, type, stage, value, currency, expected_close, owner, service_id, program_id, notes, closed_at, created_at, updated_at";

export type Activity = { id: string; company_id: string; deal_id: string | null; kind: string; body: string; due_at: string | null; done_at: string | null; author: string | null; created_at: string };
const ACTIVITY_COLS = "id, company_id, deal_id, kind, body, due_at, done_at, author, created_at";

export type CompanyPerson = { id: string; role: string | null; key: string; name: string; email: string | null; member: boolean; href: string };
export type CompanyRow = Company & { people: number; deals: Pick<Deal, "stage" | "value" | "currency">[]; ownerName: string | null; openTasks: number };
export type Option = { value: string; label: string };

/** Partners and team members, for "owner" (id → display name). */
export async function staffNames(): Promise<Map<string, string>> {
  if (!supabaseConfigured) return new Map();
  const { data } = await createServiceClient().from("admin_users").select("user_id, display_name, paused_at");
  return new Map(((data ?? []) as { user_id: string; display_name: string }[]).map((a) => [a.user_id, a.display_name]));
}

export async function listCompanies(): Promise<CompanyRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: companies }, { data: people }, { data: deals }, { data: tasks }, names] = await Promise.all([
    supabase.from("companies").select(COMPANY_COLS).order("name").limit(2000),
    supabase.from("company_people").select("company_id").limit(20000),
    supabase.from("deals").select("company_id, stage, value, currency").limit(20000),
    supabase.from("company_activities").select("company_id").eq("kind", "task").is("done_at", null).limit(20000),
    staffNames(),
  ]);
  const count = new Map<string, number>();
  for (const p of (people ?? []) as { company_id: string }[]) count.set(p.company_id, (count.get(p.company_id) ?? 0) + 1);
  const taskCount = new Map<string, number>();
  for (const t of (tasks ?? []) as { company_id: string }[]) taskCount.set(t.company_id, (taskCount.get(t.company_id) ?? 0) + 1);
  const byCompany = new Map<string, Pick<Deal, "stage" | "value" | "currency">[]>();
  for (const d of (deals ?? []) as (Pick<Deal, "stage" | "value" | "currency"> & { company_id: string })[]) {
    const list = byCompany.get(d.company_id) ?? [];
    list.push({ stage: d.stage, value: d.value === null ? null : Number(d.value), currency: d.currency });
    byCompany.set(d.company_id, list);
  }
  return ((companies ?? []) as Company[]).map((c) => ({
    ...c,
    people: count.get(c.id) ?? 0,
    deals: byCompany.get(c.id) ?? [],
    ownerName: c.owner ? names.get(c.owner) ?? null : null,
    openTasks: taskCount.get(c.id) ?? 0,
  }));
}

/** Members and added contacts who can be linked to a business. */
export async function linkableOptions(contacts?: Contact[]): Promise<Option[]> {
  const list = contacts ?? (await loadPeople()).contacts;
  return list
    .filter((c) => c.memberId || c.contactId)
    .map((c) => ({ value: c.memberId ? `m:${c.memberId}` : `c:${c.contactId}`, label: `${c.name}${c.email ? ` · ${c.email}` : ""}${c.memberId ? "" : " (contact)"}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export type TimelineEntry = { key: string; at: string; kind: string; title: string; detail?: string; who?: string; due_at?: string | null; done_at?: string | null; id?: string; deal?: string };

export type CompanyView = {
  company: Company;
  ownerName: string | null;
  people: CompanyPerson[];
  deals: (Deal & { ownerName: string | null })[];
  timeline: TimelineEntry[];
  linkOptions: Option[];
};

/** One business with its people, deals and a single timeline: team activity, deal stages, and what its people did on the platform. */
export async function getCompany(id: string): Promise<CompanyView | null> {
  if (!supabaseConfigured || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select(COMPANY_COLS).eq("id", id).maybeSingle();
  if (!company) return null;
  const [{ data: links }, { data: deals }, { data: acts }, names, { contacts }] = await Promise.all([
    supabase.from("company_people").select("id, member_id, contact_id, role").eq("company_id", id).order("created_at"),
    supabase.from("deals").select(DEAL_COLS).eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("company_activities").select(ACTIVITY_COLS).eq("company_id", id).order("created_at", { ascending: false }).limit(300),
    staffNames(),
    loadPeople(),
  ]);
  const byMember = new Map(contacts.filter((c) => c.memberId).map((c) => [c.memberId!, c]));
  const byContact = new Map(contacts.filter((c) => c.contactId).map((c) => [c.contactId!, c]));
  const people: CompanyPerson[] = [];
  const platform: { who: string; item: ContactItem }[] = [];
  for (const l of (links ?? []) as { id: string; member_id: string | null; contact_id: string | null; role: string | null }[]) {
    const c = l.member_id ? byMember.get(l.member_id) : l.contact_id ? byContact.get(l.contact_id) : undefined;
    if (!c) continue;
    people.push({ id: l.id, role: l.role, key: c.key, name: c.name, email: c.email, member: Boolean(c.memberId), href: `/contacts/${slugOf(c.key)}` });
    for (const it of c.items.slice(0, 30)) platform.push({ who: c.name, item: it });
  }
  const dealTitle = new Map(((deals ?? []) as Deal[]).map((d) => [d.id, d.title]));
  const timeline: TimelineEntry[] = [
    ...((acts ?? []) as Activity[]).map((a) => ({
      key: `a${a.id}`,
      id: a.id,
      at: a.created_at,
      kind: a.kind,
      title: a.body,
      who: a.author ? names.get(a.author) ?? "Team" : undefined,
      due_at: a.due_at,
      done_at: a.done_at,
      deal: a.deal_id ? dealTitle.get(a.deal_id) : undefined,
    })),
    ...platform.map(({ who, item }, i) => ({ key: `p${i}`, at: item.at, kind: "platform", title: item.label, detail: item.status, who })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const peopleKeys = new Set(people.map((p) => p.key));
  return {
    company: company as Company,
    ownerName: company.owner ? names.get(company.owner) ?? null : null,
    people,
    deals: ((deals ?? []) as Deal[]).map((d) => ({ ...d, value: d.value === null ? null : Number(d.value), ownerName: d.owner ? names.get(d.owner) ?? null : null })),
    timeline,
    linkOptions: (await linkableOptions(contacts)).filter((o) => {
      const c = o.value.startsWith("m:") ? byMember.get(o.value.slice(2)) : byContact.get(o.value.slice(2));
      return c ? !peopleKeys.has(c.key) : true;
    }),
  };
}

export type BoardDeal = Deal & { company: string; ownerName: string | null };

export async function dealsBoard(): Promise<BoardDeal[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: deals }, { data: companies }, names] = await Promise.all([
    supabase.from("deals").select(DEAL_COLS).order("updated_at", { ascending: false }).limit(1000),
    supabase.from("companies").select("id, name").limit(5000),
    staffNames(),
  ]);
  const nameOf = new Map(((companies ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return ((deals ?? []) as Deal[]).map((d) => ({ ...d, value: d.value === null ? null : Number(d.value), company: nameOf.get(d.company_id) ?? "Business", ownerName: d.owner ? names.get(d.owner) ?? null : null }));
}

export type TaskRow = Activity & { company: string; who: string | null };

export async function openTasks(): Promise<TaskRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: tasks }, { data: companies }, names] = await Promise.all([
    supabase.from("company_activities").select(ACTIVITY_COLS).eq("kind", "task").is("done_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    supabase.from("companies").select("id, name").limit(5000),
    staffNames(),
  ]);
  const nameOf = new Map(((companies ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return ((tasks ?? []) as Activity[]).map((t) => ({ ...t, company: nameOf.get(t.company_id) ?? "Business", who: t.author ? names.get(t.author) ?? null : null }));
}

export type Suggestion = { key: string; memberId: string; memberName: string; memberHref: string; name: string; type: string | null; stage: string | null; website: string | null; linkedin: string | null; role: string | null; match: { id: string; name: string } | null };

/**
 * Businesses members listed in their profiles that aren't linked in the CRM yet, with the likely match
 * (same website, or the same name written differently) when there is one.
 */
export async function memberBusinessSuggestions(): Promise<Suggestion[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: biz }, { data: companies }, { data: links }, { contacts }] = await Promise.all([
    createServiceClient().from("member_businesses").select("member_id, name, type, stage, website, member_role, linkedin, position").limit(5000),
    supabase.from("companies").select("id, name, website").limit(5000),
    supabase.from("company_people").select("company_id, member_id").not("member_id", "is", null).limit(20000),
    loadPeople(),
  ]);
  const comps = (companies ?? []) as { id: string; name: string; website: string | null }[];
  const byDomain = new Map(comps.filter((c) => domainOf(c.website)).map((c) => [domainOf(c.website), c]));
  const byName = new Map(comps.map((c) => [nameKey(c.name), c]));
  const linked = new Set(((links ?? []) as { company_id: string; member_id: string }[]).map((l) => `${l.company_id}:${l.member_id}`));
  const memberName = new Map(contacts.filter((c) => c.memberId).map((c) => [c.memberId!, c]));
  const out: Suggestion[] = [];
  for (const b of (biz ?? []) as { member_id: string; name: string; type: string | null; stage: string | null; website: string | null; member_role: string | null; linkedin: string | null; position: number }[]) {
    const m = memberName.get(b.member_id);
    if (!m) continue; // admins, or members since removed
    const match = (domainOf(b.website) && byDomain.get(domainOf(b.website))) || byName.get(nameKey(b.name)) || null;
    if (match && linked.has(`${match.id}:${b.member_id}`)) continue;
    out.push({
      key: `${b.member_id}:${b.position}`,
      memberId: b.member_id,
      memberName: m.name,
      memberHref: `/contacts/${slugOf(m.key)}`,
      name: b.name,
      type: b.type,
      stage: b.stage,
      website: b.website,
      linkedin: b.linkedin,
      role: b.member_role,
      match: match ? { id: match.id, name: match.name } : null,
    });
  }
  return out.sort((a, b) => Number(Boolean(b.match)) - Number(Boolean(a.match)) || a.name.localeCompare(b.name));
}

/** The businesses a member or contact is linked to (for their contact page). */
export async function companiesFor(memberId: string | null, contactId: string | null): Promise<{ id: string; name: string; role: string | null }[]> {
  if (!supabaseConfigured || (!memberId && !contactId)) return [];
  const supabase = await createClient();
  const q = supabase.from("company_people").select("role, companies(id, name)");
  const { data } = await (memberId && contactId ? q.or(`member_id.eq.${memberId},contact_id.eq.${contactId}`) : memberId ? q.eq("member_id", memberId) : q.eq("contact_id", contactId!));
  return ((data ?? []) as unknown as { role: string | null; companies: { id: string; name: string } | null }[])
    .filter((r) => r.companies)
    .map((r) => ({ id: r.companies!.id, name: r.companies!.name, role: r.role }));
}

/** Counts for the admin Overview. */
export async function crmCounts(): Promise<{ openDeals: number; tasksDue: number }> {
  if (!supabaseConfigured) return { openDeals: 0, tasksDue: 0 };
  const supabase = await createClient();
  const [{ data: deals }, { count }] = await Promise.all([
    supabase.from("deals").select("stage").limit(5000),
    supabase.from("company_activities").select("id", { count: "exact", head: true }).eq("kind", "task").is("done_at", null).lte("due_at", new Date(Date.now() + 86_400_000).toISOString()),
  ]);
  return { openDeals: ((deals ?? []) as { stage: string }[]).filter((d) => isOpen(d.stage)).length, tasksDue: count ?? 0 };
}

/** Services and programs a deal can be for. */
export async function dealTargets(): Promise<{ services: Option[]; programs: Option[] }> {
  if (!supabaseConfigured) return { services: [], programs: [] };
  const supabase = await createClient();
  const [{ data: s }, { data: p }] = await Promise.all([supabase.from("services").select("id, name").order("name"), supabase.from("programs").select("id, name").order("name")]);
  return {
    services: ((s ?? []) as { id: string; name: string }[]).map((x) => ({ value: x.id, label: x.name })),
    programs: ((p ?? []) as { id: string; name: string }[]).map((x) => ({ value: x.id, label: x.name })),
  };
}
