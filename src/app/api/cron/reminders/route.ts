import { NextResponse, type NextRequest } from "next/server";
import { sendEventReminder } from "@/lib/email/booking";
import { sendClassroomReminder } from "@/lib/email/tvs";
import { formatDateTime } from "@/lib/events/format";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Daily at 09:00 Cairo (vercel.json): email a reminder to everyone with a confirmed booking for an
 * event in the next 24-48 hours, and expire lapsed reservations. Vercel sends the CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });

  const svc = createServiceClient();
  await svc.rpc("expire_holds");

  const from = new Date(Date.now() + 15 * 3_600_000).toISOString();
  const to = new Date(Date.now() + 39 * 3_600_000).toISOString();
  const { data: events } = await svc.from("events").select("id, title, starts_at, venue").eq("status", "published").gte("starts_at", from).lt("starts_at", to);

  let sent = 0;
  for (const e of events ?? []) {
    const { data: bookings } = await svc.from("bookings").select("member_id, tickets(code)").eq("event_id", e.id).eq("status", "confirmed");
    for (const b of bookings ?? []) {
      const { data: u } = await svc.auth.admin.getUserById(b.member_id as string);
      const code = (b.tickets as unknown as { code: string } | null)?.code;
      if (u?.user?.email && code) {
        await sendEventReminder(u.user.email, { code, event: e }).then(() => sent++, () => {});
      }
    }
  }
  const classroom = await classroomReminders(svc);
  return NextResponse.json({ events: events?.length ?? 0, sent, classroom });
}

/**
 * Classroom: assignments due and live sessions starting in the next 24 hours, one email per learner.
 * Work already handed in is skipped.
 */
async function classroomReminders(svc: ReturnType<typeof createServiceClient>) {
  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const [{ data: work }, { data: sessions }] = await Promise.all([
    svc.from("assignments").select("id, title, due_at, modules(cohort_id, opens_at)").gt("due_at", now).lte("due_at", soon),
    svc.from("class_sessions").select("id, cohort_id, title, starts_at, meet_url").gt("starts_at", now).lte("starts_at", soon),
  ]);
  type Item = { kind: "assignment" | "session"; title: string; when: string; meet?: string | null };
  const byCohort = new Map<string, { item: Item; assignmentId?: string }[]>();
  for (const a of (work ?? []) as unknown as { id: string; title: string; due_at: string; modules: { cohort_id: string; opens_at: string | null } | null }[]) {
    if (!a.modules?.opens_at || new Date(a.modules.opens_at).getTime() > Date.now()) continue;
    byCohort.set(a.modules.cohort_id, [...(byCohort.get(a.modules.cohort_id) ?? []), { item: { kind: "assignment", title: a.title, when: formatDateTime(a.due_at) }, assignmentId: a.id }]);
  }
  for (const s of (sessions ?? []) as { cohort_id: string; title: string; starts_at: string; meet_url: string | null }[]) {
    byCohort.set(s.cohort_id, [...(byCohort.get(s.cohort_id) ?? []), { item: { kind: "session", title: s.title, when: formatDateTime(s.starts_at), meet: s.meet_url } }]);
  }
  let emails = 0;
  for (const [cohortId, entries] of byCohort) {
    const { data: ens } = await svc.from("enrolments").select("member_id").eq("cohort_id", cohortId).eq("status", "confirmed");
    const ids = entries.map((e) => e.assignmentId).filter(Boolean) as string[];
    const { data: subs } = ids.length ? await svc.from("submissions").select("assignment_id, member_id").in("assignment_id", ids) : { data: [] };
    const handed = new Set(((subs ?? []) as { assignment_id: string; member_id: string }[]).map((x) => `${x.member_id}:${x.assignment_id}`));
    for (const { member_id } of (ens ?? []) as { member_id: string }[]) {
      const items = entries.filter((e) => !e.assignmentId || !handed.has(`${member_id}:${e.assignmentId}`)).map((e) => e.item);
      if (!items.length) continue;
      const { data: u } = await svc.auth.admin.getUserById(member_id);
      if (u?.user?.email) await sendClassroomReminder(u.user.email, items).then(() => emails++, () => {});
    }
  }
  return emails;
}
