import "server-only";
import { adminListEvents, type AdminEvent } from "@/lib/events/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { LiveState, QueueItem } from "./format";

export type LiveShow = { eventId: string; title: string; startsAt: string | null };

/** Shows where live mode is open right now and the signed-in member holds a confirmed ticket. */
export async function myLiveShows(): Promise<LiveShow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  // Row level security only returns sessions for shows this member holds a confirmed ticket to.
  const { data } = await supabase.from("live_sessions").select("event_id, events(title, starts_at)").eq("is_open", true);
  return ((data ?? []) as unknown as { event_id: string; events: { title: string; starts_at: string | null } | null }[]).map((r) => ({
    eventId: r.event_id,
    title: r.events?.title ?? "Live show",
    startsAt: r.events?.starts_at ?? null,
  }));
}

/** The member's next show with a confirmed ticket (for the "opens when doors open" message). */
export async function myNextShow(memberId: string): Promise<LiveShow | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { data } = await supabase
    .from("bookings")
    .select("event_id, events!inner(title, starts_at, type)")
    .eq("member_id", memberId)
    .eq("status", "confirmed")
    .neq("events.type", "masterclass")
    .gte("events.starts_at", since);
  const rows = ((data ?? []) as unknown as { event_id: string; events: { title: string; starts_at: string } }[]).sort((a, b) => a.events.starts_at.localeCompare(b.events.starts_at));
  const r = rows[0];
  return r ? { eventId: r.event_id, title: r.events.title, startsAt: r.events.starts_at } : null;
}

export async function loadLiveState(eventId: string): Promise<LiveState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("live_state", { p_event: eventId });
  if (error) return null;
  return data as LiveState;
}

// ---------------------------------------------------------------- admin

export type AdminLiveQuestion = QueueItem & { id: string; text: string; who: string; anonymous: boolean; picked_at: string | null };
export type AdminPoll = { id: string; question: string; is_open: boolean; created_at: string; options: { id: string; label: string; votes: number }[] };
export type AdminLive = {
  shows: AdminEvent[];
  event: AdminEvent | null;
  session: { is_open: boolean; moment: number; picked_question: string | null; feedback_sent_at: string | null; ended_at: string | null } | null;
  questions: AdminLiveQuestion[];
  polls: AdminPoll[];
};

/** Everything Live control needs for one show. Admin only (row level security). */
export async function adminLive(eventId?: string): Promise<AdminLive> {
  const all = await adminListEvents("outloud");
  const shows = all.filter((e) => e.type !== "private_session" && e.starts_at);
  // Default: a show that's live now, else the next upcoming show, else the latest one.
  const now = Date.now();
  const supabase = await createClient();
  const { data: open } = await supabase.from("live_sessions").select("event_id").eq("is_open", true);
  const openIds = new Set((open ?? []).map((r) => r.event_id as string));
  const upcoming = shows.filter((e) => new Date(e.starts_at!).getTime() > now - 6 * 3_600_000).sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
  const event = shows.find((e) => e.id === eventId) ?? shows.find((e) => openIds.has(e.id)) ?? upcoming[0] ?? shows[0] ?? null;
  if (!event) return { shows, event: null, session: null, questions: [], polls: [] };

  const [{ data: session }, { data: qs }, { data: polls }] = await Promise.all([
    supabase.from("live_sessions").select("is_open, moment, picked_question, feedback_sent_at, ended_at").eq("event_id", event.id).maybeSingle(),
    supabase.from("live_questions").select("id, text, status, anonymous, member_id, picked_at, created_at, live_votes(count)").eq("event_id", event.id),
    supabase.from("live_polls").select("id, question, is_open, created_at, live_poll_options(id, label, position, live_poll_votes(count))").eq("event_id", event.id).order("created_at"),
  ]);
  type Q = { id: string; text: string; status: QueueItem["status"]; anonymous: boolean; member_id: string; picked_at: string | null; created_at: string; live_votes: { count: number }[] };
  const rows = (qs ?? []) as unknown as Q[];
  const ids = Array.from(new Set(rows.map((r) => r.member_id)));
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = new Map(((people ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Member"]));
  type P = { id: string; question: string; is_open: boolean; created_at: string; live_poll_options: { id: string; label: string; position: number; live_poll_votes: { count: number }[] }[] };
  return {
    shows,
    event,
    session: (session as AdminLive["session"]) ?? null,
    questions: rows.map((r) => ({
      id: r.id,
      text: r.text,
      status: r.status,
      anonymous: r.anonymous,
      // Partners see the real name; the room sees "Anonymous".
      who: `${name.get(r.member_id) ?? "Member"}${r.anonymous ? " (anonymous)" : ""}`,
      picked_at: r.picked_at,
      created_at: r.created_at,
      votes: r.live_votes?.[0]?.count ?? 0,
    })),
    polls: ((polls ?? []) as unknown as P[]).map((p) => ({
      id: p.id,
      question: p.question,
      is_open: p.is_open,
      created_at: p.created_at,
      options: [...p.live_poll_options].sort((a, b) => a.position - b.position).map((o) => ({ id: o.id, label: o.label, votes: o.live_poll_votes?.[0]?.count ?? 0 })),
    })),
  };
}

/** A show's title and start time (published shows are readable by everyone). */
export async function showInfo(eventId: string): Promise<LiveShow | null> {
  if (!supabaseConfigured || !/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id, title, starts_at").eq("id", eventId).maybeSingle();
  return data ? { eventId: data.id as string, title: data.title as string, startsAt: (data.starts_at as string | null) ?? null } : null;
}
