"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Check, Copy, EyeOff, MonitorPlay, Pencil, Plus, RotateCcw, ScanLine, Shuffle, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, useRunner } from "@/components/admin/crud";
import { LivePill } from "@/components/live/live-room";
import { useLiveUpdates } from "@/components/live/use-live";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextArea, TextField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/events/format";
import { MOMENTS, pollPercents, queueOrder } from "@/lib/live/format";
import type { AdminLive, AdminPoll } from "@/lib/live/queries";
import { checkIn } from "./actions";
import { deletePoll, deleteQuestion, duplicatePoll, endShow, pickQuestion, savePoll, setLiveOpen, setMoment, setPollOpen, setQuestionStatus } from "./live-actions";

/** Outloud › Live control: door check-in, question queue, stage control and polls for one show. */
export function LiveControl({ data, base }: { data: AdminLive; base: string }) {
  const router = useRouter();
  const r = useRunner();
  const { event, session, shows } = data;
  const onChange = useCallback(() => router.refresh(), [router]);
  useLiveUpdates(event?.id ?? null, onChange, 15_000);
  const [poll, setPoll] = useState<AdminPoll | "new" | null>(null);
  const [delPoll, setDelPoll] = useState<AdminPoll | null>(null);
  const [ending, setEnding] = useState(false);

  if (!event) return <EmptyState>Add a show with a date in Events first.</EmptyState>;
  const live = Boolean(session?.is_open);
  const moment = session?.moment ?? 1;
  const questions = queueOrder(data.questions);
  const waiting = data.questions.filter((q) => q.status === "waiting").length;
  const picked = data.questions.find((q) => q.id === session?.picked_question);
  const openPoll = data.polls.find((p) => p.is_open);
  const p = poll && poll !== "new" ? poll : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        {live ? <LivePill /> : <StatusPill tone="draft">Not live</StatusPill>}
        <label htmlFor="show" className="sr-only">Show</label>
        <select
          id="show"
          value={event.id}
          onChange={(e) => router.push(`${base}/outloud?tab=live&event=${e.target.value}`)}
          className="h-10 min-w-[220px] max-w-full rounded-lg border border-line2 bg-card px-2.5 text-[13.5px] font-bold desk:h-9"
        >
          {shows.map((s) => (
            <option key={s.id} value={s.id}>{s.title}{s.starts_at ? ` · ${formatDateTime(s.starts_at)}` : ""}</option>
          ))}
        </select>
        <span className="flex-1" />
        <span className="text-[13px] text-faint">Checked in <b className="font-display text-fg">{event.checkedIn} / {event.confirmed}</b></span>
        <Link href={`${base}/outloud/screen?event=${event.id}`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line2 bg-card px-3 text-[13.5px] font-bold hover:bg-hover desk:h-9">
          <MonitorPlay size={15} aria-hidden="true" />
          Screen view
        </Link>
        <Button variant={live ? "secondary" : "primary"} disabled={r.pending} onClick={() => r.run(() => setLiveOpen(event.id, !live))}>
          {live ? "End live mode" : "Open live mode"}
        </Button>
      </div>

      <div className="grid items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        <DoorCard base={base} />

        <Card>
          <CardHeader title="Question queue" action={<span className="font-normal text-faint">{waiting} waiting</span>} />
          {!questions.length ? <EmptyState>Questions from phones appear here.</EmptyState> : null}
          <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
            {questions.map((q) => (
              <div key={q.id} className={cn("flex flex-col gap-1.5 rounded-[9px] border p-2.5", q.status === "approved" ? "border-teal" : "border-line", q.status === "hidden" && "opacity-55")}>
                <span className="text-[13.5px] font-semibold">{q.text}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 flex-1 text-[12px] text-faint">{q.who} · {q.votes} {q.votes === 1 ? "vote" : "votes"}{q.picked_at ? " · picked" : ""}</span>
                  <StatusPill tone={q.status === "approved" ? "ok" : q.status === "hidden" ? "draft" : "warn"}>{q.status === "approved" ? "Approved" : q.status === "hidden" ? "Hidden" : "Waiting"}</StatusPill>
                  {q.status !== "approved" ? <Button size="sm" disabled={r.pending} onClick={() => r.run(() => setQuestionStatus(q.id, "approved"))}><Check size={14} aria-hidden="true" />Approve</Button> : null}
                  {q.status !== "hidden" ? <Button size="sm" variant="secondary" disabled={r.pending} onClick={() => r.run(() => setQuestionStatus(q.id, "hidden"))}><EyeOff size={14} aria-hidden="true" />Hide</Button> : null}
                  {q.status === "hidden" ? <IconBtn label="Back to waiting" onClick={() => r.run(() => setQuestionStatus(q.id, "waiting"))}><RotateCcw size={15} aria-hidden="true" /></IconBtn> : null}
                  <IconBtn label="Delete question" onClick={() => r.run(() => deleteQuestion(q.id))}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card tone="ink" className="gap-3">
          <h2 className="text-[15px] font-bold text-white">Stage control</h2>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Moment">
            {MOMENTS.map((m, i) => (
              <button
                key={m}
                type="button"
                aria-pressed={moment === i + 1}
                disabled={!session || r.pending}
                onClick={() => r.run(() => setMoment(event.id, i + 1))}
                className={cn("min-h-10 cursor-pointer rounded-lg border px-2 text-left text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50", moment === i + 1 ? "border-teal bg-teal text-ink" : "border-ink-line text-ink-fg hover:border-teal")}
              >
                {i + 1}. {m}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-[10px] bg-ink2 p-3">
            <span className="text-[11px] font-extrabold tracking-[1.2px] text-teal uppercase">The Pick · random from approved</span>
            <b className="text-[14px] leading-[1.35] text-white">{picked ? `“${picked.text}”` : "Approve questions, then pick one at random."}</b>
            {picked ? <span className="text-[12px] text-ink-muted">{picked.who}</span> : null}
            <Button variant="teal" className="self-start" disabled={!session || r.pending} onClick={() => r.run(() => pickQuestion(event.id))}>
              <Shuffle size={15} aria-hidden="true" />
              Pick a question
            </Button>
          </div>
          {openPoll ? <PollResults poll={openPoll} onClose={() => r.run(() => setPollOpen(openPoll.id, false))} /> : <span className="text-[12.5px] text-ink-muted">No poll open. Open one from Polls below.</span>}
          <button type="button" disabled={!session || r.pending} onClick={() => setEnding(true)} className="min-h-10 cursor-pointer rounded-lg bg-white px-3 text-[13.5px] font-bold text-ink disabled:opacity-50">
            End show · send feedback form
          </button>
          {!session ? <span className="text-[12px] text-ink-muted">Open live mode to use stage control.</span> : session.feedback_sent_at ? <span className="text-[12px] text-ink-muted">Feedback form sent {formatDateTime(session.feedback_sent_at)}.</span> : null}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Polls"
          action={
            <Button size="sm" onClick={() => { r.setError(null); setPoll("new"); }}>
              <Plus size={14} aria-hidden="true" />
              New poll
            </Button>
          }
        />
        {!data.polls.length ? <EmptyState>Write polls before the show, then open one at a time from here.</EmptyState> : null}
        <ul className="flex flex-col">
          {data.polls.map((pl) => {
            const total = pl.options.reduce((n, o) => n + o.votes, 0);
            return (
              <li key={pl.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2.5 last:border-b-0">
                <span className="min-w-[200px] flex-1">
                  <b className="block text-[13.5px]">{pl.question}</b>
                  <span className="text-[12px] text-faint">{pl.options.map((o) => o.label).join(" · ")} · {total} {total === 1 ? "vote" : "votes"}</span>
                </span>
                <StatusPill tone={pl.is_open ? "ok" : "draft"}>{pl.is_open ? "Open" : "Closed"}</StatusPill>
                <Button size="sm" variant={pl.is_open ? "secondary" : "primary"} disabled={r.pending} onClick={() => r.run(() => setPollOpen(pl.id, !pl.is_open))}>{pl.is_open ? "Close" : "Open"}</Button>
                <IconBtn label={`Edit ${pl.question}`} onClick={() => { r.setError(null); setPoll(pl); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                <IconBtn label={`Duplicate ${pl.question}`} onClick={() => r.run(() => duplicatePoll(pl.id))}><Copy size={15} aria-hidden="true" /></IconBtn>
                <IconBtn label={`Delete ${pl.question}`} onClick={() => setDelPoll(pl)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
              </li>
            );
          })}
        </ul>
      </Card>

      <EditorDrawer open={poll !== null} onClose={() => setPoll(null)} eyebrow="Live control" title={p ? "Edit poll" : "New poll"} pending={r.pending} error={r.error} formKey={p?.id ?? "new"} onSubmit={(fd) => r.run(() => savePoll(fd), () => setPoll(null))}>
        <input type="hidden" name="event_id" value={event.id} />
        {p ? <input type="hidden" name="id" value={p.id} /> : null}
        <TextField label="Question" name="question" defaultValue={p?.question ?? "What should we discuss next?"} required maxLength={160} />
        <TextArea label="Options" name="options" rows={4} defaultValue={p?.options.map((o) => o.label).join("\n") ?? ""} required hint="One per line, 2 to 4 options. Options you keep keep their votes." />
      </EditorDrawer>
      <ConfirmDelete name={delPoll?.question} open={delPoll !== null} onClose={() => setDelPoll(null)} pending={r.pending} note="Its votes are deleted too." onConfirm={() => delPoll && r.run(() => deletePoll(delPoll.id), () => setDelPoll(null))} />
      <ConfirmEnd open={ending} onClose={() => setEnding(false)} pending={r.pending} sent={Boolean(session?.feedback_sent_at)} onConfirm={() => r.run(() => endShow(event.id), () => setEnding(false))} />
    </>
  );
}

function PollResults({ poll, onClose }: { poll: AdminPoll; onClose: () => void }) {
  const pct = pollPercents(poll.options.map((o) => o.votes));
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-ink-line p-3">
      <b className="text-[13.5px] text-white">Poll · {poll.question}</b>
      {poll.options.map((o, i) => (
        <div key={o.id} className="flex flex-col gap-1 text-[12.5px]">
          <span className="flex justify-between gap-2"><span>{o.label}</span><span className="font-display">{o.votes} · {pct[i]}%</span></span>
          <span className="h-2 overflow-hidden rounded-full bg-ink2" aria-hidden="true"><span className="block h-full rounded-full bg-teal" style={{ width: `${pct[i]}%` }} /></span>
        </div>
      ))}
      <button type="button" onClick={onClose} className="min-h-9 cursor-pointer self-start rounded-lg border border-[#3A5A57] px-3 text-[12.5px] font-bold text-ink-fg hover:border-teal">Close poll</button>
    </div>
  );
}

function DoorCard({ base }: { base: string }) {
  const [code, setCode] = useState("");
  const [last, setLast] = useState<{ ok: boolean; text: string }[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const headline: Record<string, string> = { ok: "Checked in", already: "Already checked in", unpaid: "Not paid yet", not_found: "Ticket not found", cancelled: "Booking cancelled", expired: "Reservation expired", refunded: "Booking refunded" };
  return (
    <Card>
      <CardHeader title="Door check-in" action={<Link href={`${base}/check-in`} className="text-link inline-flex items-center gap-1"><ScanLine size={14} aria-hidden="true" />Camera scanner</Link>} />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (!c) return;
          start(async () => {
            const res = await checkIn(c);
            const line = "error" in res ? { ok: false, text: res.error } : { ok: res.result === "ok", text: `${res.name ?? res.code} · ${headline[res.result] ?? res.result}${res.seats ? ` · ${res.seats} seat${res.seats === 1 ? "" : "s"}` : ""}` };
            setLast((l) => [line, ...l].slice(0, 4));
            setCode("");
            router.refresh();
          });
        }}
      >
        <label htmlFor="door-code" className="sr-only">Ticket code</label>
        <input id="door-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VW-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} className="h-10 min-w-0 flex-1 rounded-lg border border-line2 bg-card px-2.5 text-[13.5px] focus:border-primary focus:outline-none desk:h-9" />
        <Button type="submit" disabled={pending || !code.trim()}>Check in</Button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-1.5">
        {last.map((l, i) => (
          <div key={i} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px]", l.ok ? "bg-soft" : "bg-warn-bg")}>
            <i className={cn("h-2 w-2 shrink-0 rounded-full", l.ok ? "bg-primary" : "bg-out")} aria-hidden="true" />
            <span className="font-semibold">{l.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ConfirmEnd({ open, onClose, onConfirm, pending, sent }: { open: boolean; onClose: () => void; onConfirm: () => void; pending: boolean; sent: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="End the show?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Not yet</Button>
          <Button disabled={pending} onClick={onConfirm}>End show</Button>
        </>
      }
    >
      <p className="text-[13.5px]">
        The poll closes and phones move to <b>Your voice</b>.{" "}
        {sent ? "The feedback email was already sent, so it won't go again." : "Attendees who chose The Floor Notes get an email asking what the next show should be about."}
      </p>
    </Modal>
  );
}
