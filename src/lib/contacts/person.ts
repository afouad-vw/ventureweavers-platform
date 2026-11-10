import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatEGP as egp } from "@/lib/events/format";
import type { LedgerRow } from "@/lib/payments/format";
import { applicationLabel } from "@/lib/tvs/format";
import { loadPeople, type Contact, type Space } from "./queries";
import { auditItem, sortTimeline, type TimelineItem } from "./timeline";

/**
 * One person for the contact page. Read with the service key, so callers must pass requireAdmin() first.
 * URL slugs are the list keys with "-" for ":" (m-<member id>, c-<contact id>, w-<waitlist id>).
 */
export const slugOf = (key: string) => key.replace(":", "-");
const keyOf = (slug: string) => (/^[mcw]-[0-9a-f-]{36}$/.test(slug) ? slug.replace("-", ":") : null);

export type MemberAccount = {
  provider: string;
  emailConfirmed: boolean;
  lastSignIn: string | null;
  suspended: { at: string; reason: string; by: string } | null;
  isAdmin: boolean;
  newsletter: boolean;
  stage: string | null;
  edit: { name: string; phone: string | null; linkedin: string | null; country: string | null; role: string | null; goals: string[]; contact: string[] };
};

export type PersonRequest = {
  id: string;
  service: string;
  space: Space;
  status: string;
  createdAt: string;
  preferredAt: string | null;
  meetingAt: string | null;
  meetingUrl: string | null;
  calendly: boolean;
  company: string;
  note: string;
  owner: string | null;
};

export type Person = {
  contact: Contact;
  requests: PersonRequest[];
  account: MemberAccount | null;
  timeline: TimelineItem[];
  payments: LedgerRow[];
};

const PROVIDER: Record<string, string> = { google: "Google", linkedin_oidc: "LinkedIn", email: "Email and password" };

export async function loadPerson(slug: string): Promise<Person | null> {
  if (!supabaseConfigured) return null;
  const key = keyOf(slug);
  if (!key) return null;
  const { contacts } = await loadPeople();
  const contact = contacts.find((c) => c.key === key) ?? (key.startsWith("c:") ? contacts.find((c) => c.contactId === key.slice(2)) : undefined);
  if (!contact) return null;

  const svc = createServiceClient();
  const id = contact.memberId;
  const timeline: TimelineItem[] = [];
  const auditIds = [id, contact.contactId].filter(Boolean) as string[];
  const { data: admins } = await svc.from("admin_users").select("user_id, display_name");
  const adminName = new Map(((admins ?? []) as { user_id: string; display_name: string }[]).map((a) => [a.user_id, a.display_name.split(" ")[0]]));

  const logs = auditIds.length
    ? await svc.from("audit_log").select("id, actor, action, at, before, after").in("entity_id", auditIds).order("at", { ascending: false }).limit(200)
    : { data: [] };
  for (const l of (logs.data ?? []) as { id: number; actor: string | null; action: string; at: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }[]) {
    const it = auditItem(l, (l.actor && adminName.get(l.actor)) || "A partner");
    if (it) timeline.push(it);
  }

  if (!id) {
    timeline.push({ key: "added", at: contact.joinedAt, space: "House", title: contact.source });
    for (const it of contact.items) timeline.push({ key: `i${it.at}${it.label}`, at: it.at, space: it.space, title: it.label, status: it.status });
    return { contact, account: null, timeline: sortTimeline(timeline), payments: [], requests: [] };
  }

  const [user, profile, suspension, bookings, apps, enrols, reqs, payReqs, waitlist, questions, topics, subs, ledger] = await Promise.all([
    svc.auth.admin.getUserById(id),
    svc.from("profiles").select("full_name, phone, linkedin, country, role, stage, goals, contact_prefs, consent_newsletter, created_at").eq("id", id).maybeSingle(),
    svc.from("member_suspensions").select("reason, suspended_by, suspended_at").eq("member_id", id).maybeSingle(),
    svc.from("bookings").select("id, status, seats, amount_piasters, created_at, events(title, type)").eq("member_id", id),
    svc.from("applications").select("id, status, created_at, programs(name)").eq("member_id", id),
    svc.from("enrolments").select("id, status, amount_piasters, offered_at, confirmed_at, cohorts(label, programs(name))").eq("member_id", id),
    svc.from("requests").select("id, status, space, created_at, preferred_at, meeting_at, meeting_url, calendly_invitee, company, note, owner, services(name)").eq("member_id", id).order("created_at", { ascending: false }),
    svc.from("payment_requests").select("id, item, space, amount_piasters, status, created_at, paid_at").eq("member_id", id),
    svc.from("waitlist").select("id, role, joined_at").eq("member_id", id),
    svc.from("live_questions").select("id, text, status, picked_at, created_at, events(title)").eq("member_id", id).order("created_at", { ascending: false }).limit(50),
    svc.from("topic_suggestions").select("id, text, created_at").eq("member_id", id).limit(50),
    svc.from("submissions").select("id, status, submitted_at, assignments(title)").eq("member_id", id).limit(100),
    // The payments view only answers admins, so it is read with the admin's own session.
    (await createClient()).from("payments_ledger").select("*").eq("member_id", id).order("created_at", { ascending: false }).limit(500),
  ]);

  const u = user.data?.user as { email_confirmed_at?: string | null; last_sign_in_at?: string | null; app_metadata?: { provider?: string; providers?: string[] } } | undefined;
  const p = profile.data as { full_name: string | null; phone: string | null; linkedin: string | null; country: string | null; role: string | null; stage: string | null; goals: string[] | null; contact_prefs: string[] | null; consent_newsletter: boolean; created_at: string } | null;
  const s = suspension.data as { reason: string; suspended_by: string | null; suspended_at: string } | null;
  const providers = u?.app_metadata?.providers ?? [u?.app_metadata?.provider ?? "email"];

  timeline.push({ key: "joined", at: p?.created_at ?? contact.joinedAt, space: "House", title: "Joined VentureWeavers", detail: contact.source });
  for (const b of (bookings.data ?? []) as unknown as { id: string; status: string; seats: number; amount_piasters: number; created_at: string; events: { title: string; type: string } | null }[]) {
    timeline.push({ key: `b${b.id}`, at: b.created_at, space: b.events?.type === "masterclass" ? "TVS" : "Outloud", title: `Booked ${b.events?.title ?? "an event"}`, detail: `${b.seats} ${b.seats === 1 ? "seat" : "seats"} · ${egp(b.amount_piasters)}`, status: b.status });
  }
  for (const a of (apps.data ?? []) as unknown as { id: string; status: string; created_at: string; programs: { name: string } | null }[]) {
    timeline.push({ key: `a${a.id}`, at: a.created_at, space: "TVS", title: `Applied to ${a.programs?.name ?? "a program"}`, status: applicationLabel(a.status) });
  }
  for (const e of (enrols.data ?? []) as unknown as { id: string; status: string; amount_piasters: number; offered_at: string; confirmed_at: string | null; cohorts: { label: string; programs: { name: string } | null } | null }[]) {
    const prog = `${e.cohorts?.programs?.name ?? "Program"} · ${e.cohorts?.label ?? "Cohort"}`;
    timeline.push({ key: `eo${e.id}`, at: e.offered_at, space: "TVS", title: `Offered a seat in ${prog}`, detail: egp(e.amount_piasters), status: e.status === "cancelled" ? "Cancelled" : undefined });
    if (e.confirmed_at) timeline.push({ key: `ec${e.id}`, at: e.confirmed_at, space: "TVS", title: `Enrolled in ${prog}`, status: "Enrolled" });
  }
  type ReqRow = { id: string; status: string; space: Space; created_at: string; preferred_at: string | null; meeting_at: string | null; meeting_url: string | null; calendly_invitee: string | null; company: string; note: string; owner: string | null; services: { name: string } | null };
  const reqRows = (reqs.data ?? []) as unknown as ReqRow[];
  for (const r of reqRows) {
    timeline.push({ key: `r${r.id}`, at: r.created_at, space: r.space, title: `Requested ${r.services?.name ?? "a meeting"}`, detail: r.calendly_invitee ? "Booked through Calendly" : undefined, status: applicationLabel(r.status) });
  }
  for (const q of (payReqs.data ?? []) as { id: string; item: string; space: Space | "House"; amount_piasters: number; status: string; created_at: string; paid_at: string | null }[]) {
    timeline.push({ key: `pq${q.id}`, at: q.created_at, space: q.space, title: `Payment request: ${q.item}`, detail: egp(q.amount_piasters), status: q.status });
    if (q.paid_at) timeline.push({ key: `pp${q.id}`, at: q.paid_at, space: q.space, title: `Paid: ${q.item}`, detail: egp(q.amount_piasters) });
  }
  for (const w of (waitlist.data ?? []) as { id: string; role: string; joined_at: string }[]) {
    timeline.push({ key: `w${w.id}`, at: w.joined_at, space: "QuidQuo", title: "Joined the QuidQuo waitlist", detail: w.role });
  }
  for (const q of (questions.data ?? []) as unknown as { id: string; text: string; status: string; picked_at: string | null; created_at: string; events: { title: string } | null }[]) {
    timeline.push({ key: `q${q.id}`, at: q.created_at, space: "Outloud", title: `Asked in Live mode${q.events ? ` · ${q.events.title}` : ""}`, detail: `“${q.text}”`, status: q.picked_at ? "Picked" : q.status === "hidden" ? "Hidden" : undefined });
  }
  for (const t of (topics.data ?? []) as { id: string; text: string; created_at: string }[]) {
    timeline.push({ key: `t${t.id}`, at: t.created_at, space: "Outloud", title: "Suggested a topic", detail: `“${t.text}”` });
  }
  for (const x of (subs.data ?? []) as unknown as { id: string; status: string; submitted_at: string; assignments: { title: string } | null }[]) {
    timeline.push({ key: `s${x.id}`, at: x.submitted_at, space: "TVS", title: `Handed in ${x.assignments?.title ?? "an assignment"}`, status: x.status === "reviewed" ? "Reviewed" : "Submitted" });
  }

  const payments = ((ledger.data ?? []) as Omit<LedgerRow, "member" | "email">[]).map((r) => ({ ...r, member: contact.name, email: contact.email }));

  return {
    contact,
    account: {
      provider: providers.map((x) => PROVIDER[x] ?? x).join(", "),
      emailConfirmed: Boolean(u?.email_confirmed_at),
      lastSignIn: u?.last_sign_in_at ?? null,
      suspended: s ? { at: s.suspended_at, reason: s.reason, by: (s.suspended_by && adminName.get(s.suspended_by)) || "A partner" } : null,
      isAdmin: adminName.has(id),
      newsletter: Boolean(p?.consent_newsletter),
      stage: p?.stage ?? null,
      edit: { name: p?.full_name ?? "", phone: p?.phone ?? null, linkedin: p?.linkedin ?? null, country: p?.country ?? null, role: p?.role ?? null, goals: p?.goals ?? [], contact: p?.contact_prefs ?? [] },
    },
    timeline: sortTimeline(timeline),
    payments,
    requests: reqRows.map((r) => ({
      id: r.id,
      service: r.services?.name ?? "Meeting",
      space: r.space,
      status: applicationLabel(r.status),
      createdAt: r.created_at,
      preferredAt: r.preferred_at,
      meetingAt: r.meeting_at,
      meetingUrl: r.meeting_url,
      calendly: Boolean(r.calendly_invitee),
      company: r.company,
      note: r.note,
      owner: r.owner,
    })),
  };
}
