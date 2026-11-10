"use client";

import { useCallback, useState, useTransition } from "react";
import { ArrowUp, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { MAX_QUESTION_LENGTH, MAX_QUESTIONS, momentLabel, pollPercents, type LiveState } from "@/lib/live/format";
import { askQuestion, fetchLiveState, upvote, votePoll } from "@/app/(member)/live/actions";
import { suggestTopic } from "@/app/(member)/content-actions";
import { Weave } from "@/components/ui/weave";
import { useLiveUpdates } from "./use-live";

/** The dark stage every Live mode view sits on, with the weave across the top. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-[24px] border border-white/[0.06] bg-[radial-gradient(900px_500px_at_50%_-10%,#11393a,#071112_70%)] text-ink-fg shadow-depth-lg">
      <Weave id="live-weave" className="absolute inset-x-0 top-0 -z-10 h-[260px] w-full" opacity={0.5} />
      {children}
    </div>
  );
}

const panel = "rounded-[20px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl desk:p-5";

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
      <Stage>
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-5 py-10 text-center">
          <b className="text-[13.5px] text-white">{title}</b>
          {state.ended ? (
            <>
              <h2 className="font-display text-[28px] font-semibold text-white desk:text-[34px]">Thanks for coming.</h2>
              <div className={cn(panel, "w-full max-w-[520px] text-left")}><VoiceForm /></div>
            </>
          ) : (
            <>
              <h2 className="font-display text-[28px] font-semibold text-white desk:text-[34px]">Live mode opens when doors open.</h2>
              <p className="max-w-[46ch] text-[14px]">Keep this page open. It updates on its own, and you&apos;ll be able to ask, vote and follow the show from here.</p>
            </>
          )}
        </div>
      </Stage>
    );
  }

  const total = state.poll?.options.reduce((n, o) => n + o.votes, 0) ?? 0;
  const pct = pollPercents(state.poll?.options.map((o) => o.votes) ?? []);
  const voted = Boolean(state.poll?.my_vote);
  return (
    <Stage>
      <div className="grid gap-4 p-4 desk:grid-cols-[1.3fr_1fr] desk:gap-5 desk:p-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LivePill />
            <b className="text-[13.5px] text-white">{title}</b>
          </div>
          <section aria-live="polite" className="relative min-h-[200px] overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_30px_60px_-30px_rgb(41_190_156/.45)] backdrop-blur-xl desk:min-h-[240px] desk:p-7">
            <span className="text-[11.5px] font-extrabold tracking-[2px] text-teal uppercase">On stage now · {momentLabel(state.moment)}</span>
            <p key={state.picked?.text ?? "waiting"} className="vw-rise mt-3 font-display text-[24px] leading-tight font-semibold text-white desk:text-[32px]">
              {state.picked ? `“${state.picked.text}”` : "Waiting for the hosts to pick the first question."}
            </p>
            {state.picked ? <span className="mt-2 block text-[13px] text-ink-muted">Asked by {state.picked.who}</span> : null}
          </section>

          {state.poll ? (
            <section className={cn(panel, "flex flex-col gap-2")}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[15.5px] font-bold text-white">{state.poll.question}</h2>
                <span className="shrink-0 text-[12px] text-ink-muted">{voted ? `${total} ${total === 1 ? "vote" : "votes"}` : "Tap to vote"}</span>
              </div>
              {state.poll.options.map((o, i) => (
                <PollOption key={o.id} label={o.label} percent={voted ? pct[i] : null} lead={voted && pct[i] === Math.max(...pct)} chosen={state.poll!.my_vote === o.id} onVote={() => votePoll(o.id).then(refresh)} />
              ))}
              {voted ? <span className="text-[11.5px] text-ink-muted">Tap your choice again to take it back.</span> : null}
            </section>
          ) : state.moment === 4 ? (
            <section className={cn(panel, "flex flex-col gap-2")}>
              <h2 className="text-[15.5px] font-bold text-white">Your voice</h2>
              <VoiceForm />
            </section>
          ) : null}
        </div>

        <section className={cn(panel, "flex min-w-0 flex-col gap-2.5")}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15.5px] font-bold text-white">Questions from the room</h2>
            <span className="text-[12px] text-ink-muted">Top voted</span>
          </div>
          {state.questions.length ? (
            state.questions.map((q) => (
              <div key={q.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06]">
                <span className="min-w-0 flex-1 text-[14px] text-white">
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
                      "flex min-h-11 min-w-12 cursor-pointer flex-col items-center justify-center rounded-lg border text-[12px] font-bold transition-transform active:scale-90",
                      q.voted ? "border-teal bg-teal text-ink" : "border-white/15 text-ink-fg hover:border-teal",
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
          <div className="mt-auto pt-2">
            <AskForm eventId={eventId} left={MAX_QUESTIONS - state.asked} onSent={refresh} />
          </div>
        </section>
      </div>
    </Stage>
  );
}

function PollOption({ label, percent, lead, chosen, onVote }: { label: string; percent: number | null; lead: boolean; chosen: boolean; onVote: () => Promise<unknown> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={chosen}
      disabled={pending}
      onClick={() => start(async () => void (await onVote()))}
      className={cn(
        "relative flex min-h-12 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl border px-4 text-left text-[14px] font-semibold text-white",
        chosen || lead ? "border-teal" : "border-white/10 hover:border-teal",
      )}
    >
      <i className="absolute inset-y-0 left-0 rounded-xl bg-[linear-gradient(90deg,rgb(41_190_156/.45),rgb(41_190_156/.15))] transition-[width] duration-700 ease-out" style={{ width: `${percent ?? 0}%` }} aria-hidden="true" />
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
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[14px] text-white placeholder:text-ink-muted focus:border-teal focus:outline-none"
        />
        <button type="submit" disabled={pending || !text.trim()} aria-label="Send question" className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-teal text-ink disabled:opacity-50">
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
