"use server";

import { getMember } from "@/lib/auth/guards";
import { liveError, MAX_QUESTION_LENGTH, type LiveState } from "@/lib/live/format";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function rpc(fn: string, args: Record<string, unknown>) {
  if (!(await getMember())) return { data: null, error: { message: "no_ticket" } };
  const supabase = await createClient();
  return supabase.rpc(fn, args);
}

/** Fresh live state for a show (called when Realtime says something changed, and every 10 seconds). */
export async function fetchLiveState(eventId: string): Promise<LiveState | null> {
  if (!isId(eventId)) return null;
  const { data, error } = await rpc("live_state", { p_event: eventId });
  return error ? null : (data as LiveState);
}

export async function askQuestion(eventId: string, text: string, anonymous: boolean): Promise<Result> {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!isId(eventId)) return { ok: false, error: liveError("live_closed") };
  if (!clean || clean.length > MAX_QUESTION_LENGTH) return { ok: false, error: liveError("bad_text") };
  const { error } = await rpc("live_ask", { p_event: eventId, p_text: clean, p_anonymous: anonymous });
  if (error) return { ok: false, error: liveError(error.message) };
  return { ok: true, message: "Sent. It shows to the room once the hosts approve it." };
}

export async function upvote(questionId: string): Promise<Result> {
  if (!isId(questionId)) return { ok: false, error: liveError("") };
  const { error } = await rpc("live_upvote", { p_question: questionId });
  return error ? { ok: false, error: liveError(error.message) } : { ok: true };
}

export async function votePoll(optionId: string): Promise<Result> {
  if (!isId(optionId)) return { ok: false, error: liveError("") };
  const { error } = await rpc("live_poll_vote", { p_option: optionId });
  return error ? { ok: false, error: liveError(error.message) } : { ok: true };
}
