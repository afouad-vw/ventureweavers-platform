import "server-only";
import type { TagTone } from "@/components/ui/tag";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { applicationLabel } from "@/lib/tvs/format";

/**
 * The partners' view of people. Read with the service key, so every caller must have passed
 * requireAdmin() first (the admin pages and actions do).
 */

export type Space = "Outloud" | "TVS" | "BRICKR" | "QuidQuo";
export type Activity = { at: string; text: string; space: TagTone; who: string; key: string };
export type ContactItem = { label: string; status: string; at: string; space: Space };
export type Contact = {
  key: string;
  memberId: string | null;
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  spaces: Space[];
  adminTags: Space[];
  source: string;
  consent: string;
  note: string;
  joinedAt: string;
  last: { text: string; at: string } | null;
  items: ContactItem[];
};

type AuthUser = { id: string; email?: string; created_at: string; app_metadata?: { provider?: string; providers?: string[] } };

async function allAuthUsers(): Promise<AuthUser[]> {
  const svc = createServiceClient();
  const out: AuthUser[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    out.push(...(data.users as unknown as AuthUser[]));
    if (data.users.length < 1000) break;
  }
  return out;
}

const PROVIDER: Record<string, string> = { google: "Google sign-up", linkedin_oidc: "LinkedIn sign-up", email: "Email sign-up" };

function consentOf(p: { consent_whatsapp?: boolean; consent_push?: boolean; consent_newsletter?: boolean } | undefined) {
  if (!p) return "Not asked yet";
  const parts = ["Email", p.consent_whatsapp ? "WhatsApp" : null, p.consent_push ? "push" : null].filter(Boolean);
  return parts.join(", ");
}

/** Everyone: members (except admins), contacts the partners added, and waitlist people added by admins. */
export async function loadPeople(): Promise<{ contacts: Contact[]; activity: Activity[] }> {
  if (!supabaseConfigured) return { contacts: [], activity: [] };
  const svc = createServiceClient();
  const [users, profiles, admins, bookings, enrolments, applications, requests, waitlist, topics, added, notes] = await Promise.all([
    allAuthUsers(),
    svc.from("profiles").select("id, full_name, phone, role, stage, consent_whatsapp, consent_push, consent_newsletter, created_at"),
    svc.from("admin_users").select("user_id"),
    svc.from("bookings").select("id, member_id, status, seats, created_at, events(title, type)").order("created_at", { ascending: false }).limit(5000),
    svc.from("enrolments").select("id, member_id, status, offered_at, confirmed_at, cohorts(label, programs(name))").limit(5000),
    svc.from("applications").select("id, member_id, status, created_at, programs(name)").limit(5000),
    svc.from("requests").select("id, member_id, status, space, created_at, services(name)").limit(5000),
    svc.from("waitlist").select("id, member_id, name, email, role, invited_by, joined_at").limit(10000),
    svc.from("topic_suggestions").select("id, member_id, text, created_at").order("created_at", { ascending: false }).limit(200),
    svc.from("contacts").select("id, name, email, phone, company, role, source, tags, consent, created_at").limit(10000),
    svc.from("contact_notes").select("member_id, contact_id, note, tags"),
  ]);

  const adminIds = new Set(((admins.data ?? []) as { user_id: string }[]).map((a) => a.user_id));
  const prof = new Map(((profiles.data ?? []) as { id: string; full_name: string | null; phone: string | null; role: string | null; stage: string | null; consent_whatsapp: boolean; consent_push: boolean; consent_newsletter: boolean; created_at: string }[]).map((p) => [p.id, p]));
  const noteByMember = new Map<string, { note: string; tags: Space[] }>();
  const noteByContact = new Map<string, { note: string; tags: Space[] }>();
  for (const n of (notes.data ?? []) as { member_id: string | null; contact_id: string | null; note: string; tags: Space[] }[]) {
    if (n.member_id) noteByMember.set(n.member_id, { note: n.note, tags: n.tags });
    if (n.contact_id) noteByContact.set(n.contact_id, { note: n.note, tags: n.tags });
  }

  const nameOf = (id: string, email?: string | null) => prof.get(id)?.full_name || email || "Member";
  const items = new Map<string, ContactItem[]>();
  const add = (id: string, it: ContactItem) => items.set(id, [...(items.get(id) ?? []), it]);
  const activity: Activity[] = [];
  const userEmail = new Map(users.map((u) => [u.id, u.email ?? null]));
  const who = (id: string) => nameOf(id, userEmail.get(id));

  for (const b of (bookings.data ?? []) as unknown as { id: string; member_id: string; status: string; seats: number; created_at: string; events: { title: string; type: string } | null }[]) {
    const space: Space = b.events?.type === "masterclass" ? "TVS" : "Outloud";
    add(b.member_id, { label: `Booked ${b.events?.title ?? "an event"}`, status: b.status, at: b.created_at, space });
    activity.push({ at: b.created_at, text: `${who(b.member_id)} booked ${b.events?.title ?? "an event"}${b.seats > 1 ? ` (${b.seats} seats)` : ""}`, space, who: b.member_id, key: `b${b.id}` });
  }
  for (const e of (enrolments.data ?? []) as unknown as { id: string; member_id: string; status: string; offered_at: string; confirmed_at: string | null; cohorts: { label: string; programs: { name: string } | null } | null }[]) {
    const prog = `${e.cohorts?.programs?.name ?? "Program"} · ${e.cohorts?.label ?? "Cohort"}`;
    add(e.member_id, { label: prog, status: e.status === "confirmed" ? "Enrolled" : e.status === "offered" ? "Offered" : "Cancelled", at: e.confirmed_at ?? e.offered_at, space: "TVS" });
    if (e.confirmed_at) activity.push({ at: e.confirmed_at, text: `${who(e.member_id)} enrolled in ${prog}`, space: "TVS", who: e.member_id, key: `e${e.id}` });
  }
  for (const a of (applications.data ?? []) as unknown as { id: string; member_id: string; status: string; created_at: string; programs: { name: string } | null }[]) {
    add(a.member_id, { label: `Applied to ${a.programs?.name ?? "a program"}`, status: applicationLabel(a.status), at: a.created_at, space: "TVS" });
    activity.push({ at: a.created_at, text: `${who(a.member_id)} applied to ${a.programs?.name ?? "a program"}`, space: "TVS", who: a.member_id, key: `a${a.id}` });
  }
  for (const r of (requests.data ?? []) as unknown as { id: string; member_id: string; status: string; space: Space; created_at: string; services: { name: string } | null }[]) {
    add(r.member_id, { label: `Requested ${r.services?.name ?? "a meeting"}`, status: applicationLabel(r.status), at: r.created_at, space: r.space });
    activity.push({ at: r.created_at, text: `${who(r.member_id)} requested ${r.services?.name ?? "a meeting"}`, space: r.space, who: r.member_id, key: `r${r.id}` });
  }
  const wl = (waitlist.data ?? []) as { id: string; member_id: string | null; name: string | null; email: string | null; role: string; invited_by: string | null; joined_at: string }[];
  const invitedMembers = new Set(wl.filter((w) => w.member_id && w.invited_by).map((w) => w.member_id!));
  for (const w of wl) {
    if (!w.member_id) continue;
    add(w.member_id, { label: `QuidQuo waitlist · ${w.role.toLowerCase()}`, status: "Joined", at: w.joined_at, space: "QuidQuo" });
    activity.push({ at: w.joined_at, text: `${who(w.member_id)} joined the QuidQuo waitlist`, space: "QuidQuo", who: w.member_id, key: `w${w.id}` });
  }
  for (const t of (topics.data ?? []) as { id: string; member_id: string; text: string; created_at: string }[]) {
    activity.push({ at: t.created_at, text: `${who(t.member_id)} suggested a topic: “${t.text.slice(0, 80)}”`, space: "Outloud", who: t.member_id, key: `t${t.id}` });
  }

  const contacts: Contact[] = [];

  for (const u of users) {
    if (adminIds.has(u.id)) continue;
    const p = prof.get(u.id);
    const mine = (items.get(u.id) ?? []).sort((a, b) => b.at.localeCompare(a.at));
    const n = noteByMember.get(u.id);

    const provider = u.app_metadata?.provider ?? u.app_metadata?.providers?.[0] ?? "email";
    activity.push({ at: p?.created_at ?? u.created_at, text: `${nameOf(u.id, u.email)} joined VentureWeavers`, space: "House", who: u.id, key: `u${u.id}` });
    contacts.push({
      key: `m:${u.id}`,
      memberId: u.id,
      contactId: null,
      name: nameOf(u.id, u.email),
      email: u.email ?? null,
      phone: p?.phone ?? null,
      company: null,
      role: [p?.role, p?.stage].filter(Boolean).join(" · ") || null,
      spaces: Array.from(new Set([...mine.map((i) => i.space), ...(n?.tags ?? [])])),
      adminTags: n?.tags ?? [],
      source: invitedMembers.has(u.id) ? "Invited by a member" : PROVIDER[provider] ?? "Sign-up",
      consent: consentOf(p),
      note: n?.note ?? "",
      joinedAt: p?.created_at ?? u.created_at,
      last: mine[0] ? { text: mine[0].label, at: mine[0].at } : { text: "Joined", at: p?.created_at ?? u.created_at },
      items: mine,
    });
  }

  // Contacts the partners added; one who signed up with the same email shows as the member.
  const byEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
  for (const c of (added.data ?? []) as { id: string; name: string; email: string | null; phone: string | null; company: string | null; role: string | null; source: string; tags: Space[]; consent: string; created_at: string }[]) {
    const n = noteByContact.get(c.id);
    const member = c.email ? byEmail.get(c.email.toLowerCase()) : undefined;
    if (member) {
      member.contactId = c.id;
      member.company = member.company ?? c.company;
      member.phone = member.phone ?? c.phone;
      member.spaces = Array.from(new Set([...member.spaces, ...c.tags]));
      if (!member.note && n?.note) member.note = n.note;
      continue;
    }
    contacts.push({
      key: `c:${c.id}`,
      memberId: null,
      contactId: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      role: c.role,
      spaces: Array.from(new Set([...c.tags, ...(n?.tags ?? [])])),
      adminTags: c.tags,
      source: c.source,
      consent: c.consent,
      note: n?.note ?? "",
      joinedAt: c.created_at,
      last: { text: c.source, at: c.created_at },
      items: [],
    });
  }
  // Waitlist people added by admins who aren't already a member or a contact.
  const known = new Set(contacts.map((c) => c.email?.toLowerCase()).filter(Boolean));
  for (const w of wl) {
    if (w.member_id || !w.email || known.has(w.email.toLowerCase())) continue;
    contacts.push({
      key: `w:${w.id}`,
      memberId: null,
      contactId: null,
      name: w.name || w.email,
      email: w.email,
      phone: null,
      company: null,
      role: w.role,
      spaces: ["QuidQuo"],
      adminTags: [],
      source: "Added to the QuidQuo waitlist",
      consent: "Email",
      note: "",
      joinedAt: w.joined_at,
      last: { text: "On the QuidQuo waitlist", at: w.joined_at },
      items: [{ label: `QuidQuo waitlist · ${w.role.toLowerCase()}`, status: "Joined", at: w.joined_at, space: "QuidQuo" }],
    });
  }

  contacts.sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
  activity.sort((a, b) => b.at.localeCompare(a.at));
  return { contacts, activity };
}

/** Counts for Admin › Overview › Needs attention. */
export async function attentionCounts() {
  if (!supabaseConfigured) return null;
  const svc = createServiceClient();
  const now = new Date().toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [newRequests, newApps, reservedSeats, offeredSeats, toReview, newTopics, waitlist, ...drafts] = await Promise.all([
    count(svc.from("requests").select("id", head).eq("status", "new")),
    count(svc.from("applications").select("id", head).eq("status", "new")),
    count(svc.from("bookings").select("id", head).eq("status", "reserved").gt("hold_expires_at", now)),
    count(svc.from("enrolments").select("id", head).eq("status", "offered")),
    count(svc.from("submissions").select("id", head).eq("status", "submitted")),
    count(svc.from("topic_suggestions").select("id", head).eq("status", "new")),
    count(svc.from("waitlist").select("id", head)),
    count(svc.from("events").select("id", head).eq("status", "draft")),
    count(svc.from("content_items").select("id", head).eq("status", "draft")),
    count(svc.from("blog_posts").select("id", head).eq("status", "draft")),
    count(svc.from("library_resources").select("id", head).eq("status", "draft")),
    count(svc.from("posts").select("id", head).eq("status", "draft")),
    count(svc.from("qq_log").select("id", head).eq("status", "draft")),
  ]);
  const [openReq, openApps, { data: liveNow }, pendingRequests] = await Promise.all([
    count(svc.from("requests").select("id", head).not("status", "in", "(won,declined)")),
    count(svc.from("applications").select("id", head).not("status", "in", "(won,declined)")),
    svc.from("live_sessions").select("event_id").eq("is_open", true),
    count(svc.from("payment_requests").select("id", head).eq("status", "pending")),
  ]);
  const liveIds = ((liveNow ?? []) as { event_id: string }[]).map((r) => r.event_id);
  const questions = liveIds.length ? await count(svc.from("live_questions").select("id", head).eq("status", "waiting").in("event_id", liveIds)) : 0;
  return { questions, newRequests, newApps, payments: reservedSeats + offeredSeats + pendingRequests, toReview, newTopics, waitlist, drafts: drafts.reduce((a, b) => a + b, 0), openRequests: openReq + openApps };
}
