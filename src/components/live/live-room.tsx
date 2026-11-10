"use client";

import { useCallback, useState, useTransition } from "react";
import { ArrowUp, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { MAX_QUESTION_LENGTH, MAX_QUESTIONS, momentLabel, pollPercents, type LiveState } from "@/lib/live/format";
import { askQuestion, fetchLiveState, upvote, votePoll } from "@/app/(member)/live/actions";
import { suggestTopic } from "@/app/(member)/content-actions";
import { useLiveUpdates } from "./use-live";

export function LivePill() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-xl bg-teal px-2.5 text-[11px] font-extrabold tracking-[1px] text-ink">
      <i className="live-dot h-[7px] w-[7px] rounded-full bg-ink" aria-hidden="true" />
      LIVE
    </span>
  );
}

/** Live mode on the member's phone: on stage now, the poll, questions from the room and Ask the floor. */
export function LiveRoom({ eventId, title, initial }: { eventId: string; title: string; initial: LiveState }) {
  const [state, setState] = useState<LiveState>(initial);
  const refresh = useCallback(async () => {
    const s = await fetchLiveState(eventId);
    if (s) setState(s);
  }, [eventId]);
  useLiveUpdates(eventId, refresh);

  if (!state.open) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <section className="flex flex-col gap-3.5 rounded-[14px] bg-ink p-[18px] text-ink-fg">
          <b className="text-[13.5px] text-white">{title}</b>
          {state.ended ? (
            <>
              <h2 className="font-display text-[18px] font-semibold text-white">Thanks for coming.</h2>
              <VoiceForm />
            </>
          ) : (
            <p className="text-[13.5px]">Live mode opens when doors open. Keep this page open; it updates on its own.</p>
          )}
        </section>
      </div>
    );
  }

  const total = state.poll?.options.reduce((n, o) => n + o.votes, 0) ?? 0;
  const pct = pollPercents(state.poll?.options.map((o) => o.votes) ?? []);
  const voted = Boolean(state.poll?.my_vote);
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-[14px] bg-ink p-[18px] text-ink-fg" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LivePill />
          <b className="text-[13.5px] text-white">{title}</b>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-ink2 p-3.5">
          <span className="text-[11px] font-extrabold tracking-[1.2px] text-teal uppercase">On stage now · {momentLabel(state.moment)}</span>
          <b className="font-display text-[18px] leading-[1.3] text-white">
            {state.picked ? `“${state.picked.text}”` : "Waiting for the hosts to pick the first question."}
          </b>
          {state.picked ? <span className="text-[12.5px] text-ink-muted">Asked by {state.picked.who}</span> : null}
        </div>

        {state.poll ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-white">{state.poll.question}</h2>
              <span className="text-[11.5px] text-ink-muted">{voted ? "Thanks for voting" : "Tap to vote"}</span>
            </div>
            {state.poll.options.map((o, i) => (
              <PollOption key={o.id} label={o.label} percent={voted ? pct[i] : null} chosen={state.poll!.my_vote === o.id} onVote={() => votePoll(o.id).then(refresh)} />
            ))}
            {voted ? <span className="text-[11.5px] text-ink-muted">{total} {total === 1 ? "vote" : "votes"} · tap your choice again to take it back</span> : null}
          </div>
        ) : state.moment === 4 ? (
          <div className="flex flex-col gap-2 rounded-xl bg-ink2 p-3.5">
            <h2 className="text-[15px] font-bold text-white">Your voice</h2>
            <VoiceForm />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-white">Questions from the room</h2>
            <span className="text-[11.5px] text-ink-muted">Top voted</span>
          </div>
          {state.questions.length ? (
            state.questions.map((q) => (
              <div key={q.id} className="flex items-center gap-2.5 rounded-[10px] border border-ink-line px-3 py-2.5">
                <span className="min-w-0 flex-1 text-[13.5px] text-white">
                  {q.text}
                  {q.status === "waiting" ? <span className="block text-[11.5px] font-bold text-[#F2C27A]">Waiting for approval</span> : null}
                </span>
                {q.status === "approved" ? (
                  <button
                    type="button"
                    aria-pressed={q.voted}
                    aria-label={q.voted ? `Remove your upvote (${q.votes})` : `Upvote (${q.votes})`}
                    onClick={() => upvote(q.id).then(refresh)}
                    className={cn(
                      "flex min-h-10 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg border text-[12px] font-bold",
                      q.voted ? "border-teal bg-teal text-ink" : "border-ink-line text-ink-fg hover:border-teal",
                    )}
                  >
                    <ArrowUp size={14} strokeWidth={2.4} aria-hidden="true" />
                    <span className="font-display">{q.votes}</span>
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-[13px] text-ink-muted">No questions on the floor yet. Ask the first one.</p>
          )}
        </div>

        <AskForm eventId={eventId} left={MAX_QUESTIONS - state.asked} onSent={refresh} />
      </section>
    </div>
  );
}

function PollOption({ label, percent, chosen, onVote }: { label: string; percent: number | null; chosen: boolean; onVote: () => Promise<unknown> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={chosen}
      disabled={pending}
      onClick={() => start(async () => void (await onVote()))}
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-[10px] border px-3 text-left text-[13.5px] font-semibold text-white",
        chosen ? "border-teal" : "border-ink-line hover:border-teal",
      )}
    >
      <i className="absolute inset-y-0 left-0 bg-teal/25 transition-[width]" style={{ width: `${percent ?? 0}%` }} aria-hidden="true" />
      <span className="relative">{label}</span>
      <span className="relative font-display">{percent === null ? "" : `${percent}%`}</span>
    </button>
  );
}

function AskForm({ eventId, left, onSent }: { eventId: string; left: number; onSent: () => void }) {
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (left <= 0) return <p className="text-[12.5px] text-ink-muted">You&apos;ve asked {MAX_QUESTIONS} questions in this show. Thank you!</p>;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await askQuestion(eventId, text, anonymous);
          toast(r.ok ? r.message ?? "Sent" : r.error);
          if (r.ok) {
            setText("");
            onSent();
          }
        });
      }}
    >
      <div className="flex gap-2">
        <label htmlFor="ask" className="sr-only">Your question</label>
        <input
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          required
          placeholder="Ask the floor a question"
          className="h-[42px] min-w-0 flex-1 rounded-lg border border-ink-line bg-ink2 px-3 text-[14px] text-white placeholder:text-ink-muted focus:border-teal focus:outline-none"
        />
        <button type="submit" disabled={pending || !text.trim()} aria-label="Send question" className="inline-flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-teal text-ink disabled:opacity-50">
          <Send size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-[12.5px] text-ink-fg">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-teal" />
        Ask anonymously (otherwise your first name shows)
      </label>
    </form>
  );
}

function VoiceForm() {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (sent) return <p className="text-[13.5px]">Thank you. The hosts read every one.</p>;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await suggestTopic(text);
          toast(r.ok ? r.message ?? "Sent" : r.error);
          if (r.ok) setSent(true);
        });
      }}
    >
      <label htmlFor="voice" className="text-[13px] font-bold text-white">What should the next show be about?</label>
      <input
        id="voice"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        required
        placeholder="A topic you want on stage"
        className="h-[42px] rounded-lg border border-ink-line bg-ink px-3 text-[14px] text-white placeholder:text-ink-muted focus:border-teal focus:outline-none"
      />
      <button type="submit" disabled={pending} className="inline-flex h-10 cursor-pointer items-center self-start rounded-lg bg-teal px-3.5 text-[13.5px] font-bold text-ink disabled:opacity-50">
        Send feedback
      </button>
    </form>
  );
}
