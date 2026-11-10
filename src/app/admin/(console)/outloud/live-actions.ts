"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { sendShowFeedback } from "@/lib/email/live";
import { liveError, parsePollOptions } from "@/lib/live/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function refresh() {
  revalidatePath("/admin/outloud", "layout");
  revalidatePath("/live");
}

async function call(fn: string, args: Record<string, unknown>, message: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: liveError(error.message) };
  refresh();
  return { ok: true, message };
}

export async function setLiveOpen(eventId: string, open: boolean) {
  if (!ID.test(eventId)) return { ok: false, error: "Unknown show." } as ActionResult;
  return call("admin_live_open", { p_event: eventId, p_open: open }, open ? "Live mode is open on members' phones" : "Live mode closed");
}

export async function setMoment(eventId: string, moment: number) {
  if (!ID.test(eventId) || ![1, 2, 3, 4].includes(moment)) return { ok: false, error: "Unknown moment." } as ActionResult;
  return call("admin_live_moment", { p_event: eventId, p_moment: moment }, "On stage now updated");
}

export async function pickQuestion(eventId: string) {
  if (!ID.test(eventId)) return { ok: false, error: "Unknown show." } as ActionResult;
  return call("admin_live_pick", { p_event: eventId }, "Sent to the screen and to phones");
}

export async function setQuestionStatus(id: string, status: "waiting" | "approved" | "hidden"): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id) || !["waiting", "approved", "hidden"].includes(status)) return { ok: false, error: "Unknown question." };
  const supabase = await createClient();
  const { error } = await supabase.from("live_questions").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the question." };
  await audit(admin.userId, "live.question", "live_questions", { entityId: id, after: { status } });
  refresh();
  return { ok: true, message: status === "approved" ? "Approved: it shows to the room" : status === "hidden" ? "Hidden from the room" : "Back in the queue" };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown question." };
  const supabase = await createClient();
  const { error } = await supabase.from("live_questions").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, "live.question.delete", "live_questions", { entityId: id });
  refresh();
  return { ok: true, message: "Question deleted" };
}

/** Create or edit a poll. Options are typed one per line; options that stay keep their votes. */
export async function savePoll(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id");
  const eventId = s("event_id");
  const question = s("question").replace(/\s+/g, " ");
  if (!ID.test(eventId) || (id && !ID.test(id))) return { ok: false, error: "Unknown show." };
  if (!question || question.length > 160) return { ok: false, error: "Write the poll question (up to 160 characters)." };
  const parsed = parsePollOptions(s("options"));
  if (!parsed.ok) return parsed;
  const supabase = await createClient();

  let pollId = id;
  if (id) {
    const { error } = await supabase.from("live_polls").update({ question }).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save the poll." };
  } else {
    const { data, error } = await supabase.from("live_polls").insert({ event_id: eventId, question }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't create the poll." };
    pollId = data.id as string;
  }
  const { data: existing } = await supabase.from("live_poll_options").select("id, label").eq("poll_id", pollId);
  const have = new Map(((existing ?? []) as { id: string; label: string }[]).map((o) => [o.label.toLowerCase(), o.id]));
  const keep = new Set<string>();
  for (const [i, label] of parsed.options.entries()) {
    const found = have.get(label.toLowerCase());
    if (found) {
      keep.add(found);
      await supabase.from("live_poll_options").update({ label, position: i + 1 }).eq("id", found);
    } else {
      await supabase.from("live_poll_options").insert({ poll_id: pollId, label, position: i + 1 });
    }
  }
  const drop = ((existing ?? []) as { id: string }[]).map((o) => o.id).filter((x) => !keep.has(x));
  if (drop.length) await supabase.from("live_poll_options").delete().in("id", drop);
  await audit(admin.userId, id ? "live.poll.update" : "live.poll.create", "live_polls", { entityId: pollId, after: { question, options: parsed.options } });
  refresh();
  return { ok: true, message: id ? "Poll saved" : "Poll created (closed). Open it when you're ready." };
}

export async function duplicatePoll(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown poll." };
  const supabase = await createClient();
  const { data: p } = await supabase.from("live_polls").select("event_id, question, live_poll_options(label, position)").eq("id", id).maybeSingle();
  if (!p) return { ok: false, error: "Unknown poll." };
  const { data: copy, error } = await supabase.from("live_polls").insert({ event_id: p.event_id, question: `${p.question}`.slice(0, 160) }).select("id").single();
  if (error || !copy) return { ok: false, error: "Couldn't duplicate the poll." };
  const opts = (p.live_poll_options as { label: string; position: number }[]) ?? [];
  if (opts.length) await supabase.from("live_poll_options").insert(opts.map((o) => ({ poll_id: copy.id, label: o.label, position: o.position })));
  await audit(admin.userId, "live.poll.duplicate", "live_polls", { entityId: copy.id as string });
  refresh();
  return { ok: true, message: "Poll duplicated (closed, no votes)" };
}

export async function deletePoll(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown poll." };
  const supabase = await createClient();
  const { error } = await supabase.from("live_polls").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the poll." };
  await audit(admin.userId, "live.poll.delete", "live_polls", { entityId: id });
  refresh();
  return { ok: true, message: "Poll deleted" };
}

export async function setPollOpen(id: string, open: boolean) {
  if (!ID.test(id)) return { ok: false, error: "Unknown poll." } as ActionResult;
  return call("admin_live_poll_open", { p_poll: id, p_open: open }, open ? "Poll open on phones" : "Poll closed");
}

/** End show: close the poll, move to Your Voice and (once) email the feedback link to opted-in attendees. */
export async function endShow(eventId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!ID.test(eventId)) return { ok: false, error: "Unknown show." };
  const supabase = await createClient();
  const { data: first, error } = await supabase.rpc("admin_live_end", { p_event: eventId });
  if (error) return { ok: false, error: liveError(error.message) };
  refresh();
  if (!first) return { ok: true, message: "Show ended. The feedback email was already sent." };
  if (!process.env.RESEND_API_KEY) return { ok: true, message: "Show ended. Feedback form is on phones (email isn't switched on)." };

  const svc = createServiceClient();
  const [{ data: show }, { data: bookings }] = await Promise.all([
    svc.from("events").select("id, title").eq("id", eventId).single(),
    svc.from("bookings").select("member_id").eq("event_id", eventId).eq("status", "confirmed"),
  ]);
  const ids = Array.from(new Set(((bookings ?? []) as { member_id: string }[]).map((b) => b.member_id)));
  const { data: opted } = ids.length ? await svc.from("profiles").select("id").in("id", ids).eq("consent_newsletter", true) : { data: [] };
  const recipients: { id: string; email: string }[] = [];
  for (const p of (opted ?? []) as { id: string }[]) {
    const { data: u } = await svc.auth.admin.getUserById(p.id);
    if (u?.user?.email && u.user.email_confirmed_at) recipients.push({ id: p.id, email: u.user.email });
  }
  const r = await sendShowFeedback(recipients, { id: eventId, title: (show?.title as string) ?? "the show" });
  return { ok: true, message: `Show ended. Feedback form on phones; emailed to ${r.sent} attendee${r.sent === 1 ? "" : "s"}${r.failed ? ` (${r.failed} failed)` : ""}.` };
}
