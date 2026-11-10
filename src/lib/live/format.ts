/** Live mode: shared types and small pure helpers (used on the server and in the browser). */

export const MOMENTS = ["The Pick", "Answered Together", "Guest on Stage", "Your Voice"] as const;
export const MAX_QUESTIONS = 5;
export const MAX_QUESTION_LENGTH = 280;

export type LiveQuestion = { id: string; text: string; status: "waiting" | "approved"; mine: boolean; votes: number; voted: boolean };
export type LivePollOption = { id: string; label: string; votes: number };
export type LivePoll = { id: string; question: string; my_vote: string | null; options: LivePollOption[] };
export type LiveState =
  | { open: false; ended: boolean; moment: number }
  | {
      open: true;
      moment: number;
      version: number;
      picked: { id: string; text: string; who: string } | null;
      questions: LiveQuestion[];
      asked: number;
      poll: LivePoll | null;
    };

export function momentLabel(m: number) {
  return MOMENTS[Math.min(Math.max(m, 1), 4) - 1];
}

/** Whole-number percentages that add up to 100 (largest remainder), or all zero with no votes. */
export function pollPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

export type QueueItem = { status: "waiting" | "approved" | "hidden"; votes: number; created_at: string };

/** Admin queue: waiting first, then approved, then hidden; most votes first, then oldest first. */
export function queueOrder<T extends QueueItem>(items: T[]): T[] {
  const rank = { waiting: 0, approved: 1, hidden: 2 } as const;
  return [...items].sort((a, b) => rank[a.status] - rank[b.status] || b.votes - a.votes || a.created_at.localeCompare(b.created_at));
}

/** Clean poll options typed one per line: trimmed, no blanks or repeats, 2 to 4 of them, 80 characters each. */
export function parsePollOptions(text: string): { ok: true; options: string[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const o = line.trim().replace(/\s+/g, " ");
    if (!o || seen.has(o.toLowerCase())) continue;
    if (o.length > 80) return { ok: false, error: "Keep each option under 80 characters." };
    seen.add(o.toLowerCase());
    options.push(o);
  }
  if (options.length < 2) return { ok: false, error: "Add at least 2 options, one per line." };
  if (options.length > 4) return { ok: false, error: "Use 4 options at most." };
  return { ok: true, options };
}

/** Friendly message for a database error from a live mode function. */
export function liveError(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("question_limit")) return `You've asked ${MAX_QUESTIONS} questions in this show. Thank you!`;
  if (m.includes("bad_text")) return `Write your question (up to ${MAX_QUESTION_LENGTH} characters).`;
  if (m.includes("live_closed") || m.includes("poll_closed")) return "Live mode isn't open right now.";
  if (m.includes("no_ticket")) return "Live mode is for people with a confirmed ticket to this show.";
  if (m.includes("no_approved")) return "Approve a question first. Each question is picked once.";
  if (m.includes("needs_options")) return "Add at least 2 options before opening the poll.";
  if (m.includes("not_a_show")) return "Private sessions don't have live mode.";
  if (m.includes("not_live")) return "Open live mode for this show first.";
  return "Something went wrong. Please try again.";
}
