"use client";

import { useState } from "react";
import { ChevronRight, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { InboxItem } from "@/lib/brickr/queries";
import { relativeWhen } from "@/lib/content/format";
import { formatDateTime, isoToCairoLocal } from "@/lib/events/format";
import { APPLICATION_STATUSES, applicationLabel, type ApplicationStatus } from "@/lib/tvs/format";
import { moveApplication, setApplicationOwner } from "../tvs/actions";
import { addRequestNote, confirmMeeting, deleteRequest, deleteRequestNote, exportInboxCsv, moveRequest, setRequestOwner } from "./actions";

const OWNERS = ["", "Ahmed", "Karim"];
const DOT: Record<ApplicationStatus, string> = { new: "bg-out", intro_call: "bg-tvs", proposal: "bg-brk", won: "bg-teal", declined: "bg-line2" };
const tone = (s: ApplicationStatus) => (s === "won" ? "ok" : s === "declined" ? "draft" : s === "new" ? "warn" : "blue") as "ok" | "draft" | "warn" | "blue";
const next = (s: ApplicationStatus): ApplicationStatus | null => (s === "new" ? "intro_call" : s === "intro_call" ? "proposal" : s === "proposal" ? "won" : null);

/** Every request in one place: counts per stage, filter by space, table or board, details with notes. */
export function RequestsInbox({ items, spaces, base, csv = true }: { items: InboxItem[]; spaces: ("BRICKR" | "Outloud" | "TVS")[]; base: string; csv?: boolean }) {
  const [space, setSpace] = useState<"All" | (typeof spaces)[number]>("All");
  const [view, setView] = useState<"table" | "board">("table");
  const [openId, setOpenId] = useState<string | null>(null);
  const r = useRunner();
  const toast = useToast();
  const list = items.filter((i) => space === "All" || i.space === space);
  const open = items.find((i) => i.id === openId) ?? null;

  const move = (i: InboxItem, status: ApplicationStatus) => {
    if (i.kind === "application" && status === "won") return toast("Offer a seat from TVS › Applications to move an application to Won.");
    r.run(() => (i.kind === "request" ? moveRequest(i.id, status) : moveApplication(i.id, status)));
  };
  const owner = (i: InboxItem, o: string) => r.run(() => (i.kind === "request" ? setRequestOwner(i.id, o) : setApplicationOwner(i.id, o)));

  return (
    <>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
        {APPLICATION_STATUSES.map((s) => (
          <div key={s.value} className="rounded-xl border border-line bg-card p-3">
            <small className="flex items-center gap-1.5 text-[12px] font-bold text-faint"><i className={cn("h-2 w-2 rounded-full", DOT[s.value])} aria-hidden="true" />{s.label}</small>
            <b className="font-display text-[24px]">{list.filter((i) => i.status === s.value).length}</b>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {spaces.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Space">
            {(["All", ...spaces] as const).map((x) => (
              <button key={x} type="button" aria-pressed={space === x} onClick={() => setSpace(x)} className={cn("h-9 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold desk:h-[30px]", space === x ? "border-fg bg-fg text-bg" : "border-line2 bg-card hover:bg-hover")}>
                {x === "All" ? "All spaces" : x}
              </button>
            ))}
          </div>
        ) : null}
        <span className="flex-1" />
        <div className="flex gap-1.5" role="group" aria-label="View">
          {(["table", "board"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("h-9 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold desk:h-[30px]", view === v ? "border-fg bg-fg text-bg" : "border-line2 bg-card hover:bg-hover")}>
              {v === "table" ? "Table" : "Board"}
            </button>
          ))}
        </div>
        {csv ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const res = await exportInboxCsv();
              if (!res.ok) return toast(res.error);
              const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
              const a = Object.assign(document.createElement("a"), { href: url, download: `requests-${new Date().toISOString().slice(0, 10)}.csv` });
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={14} aria-hidden="true" />
            Export CSV
          </Button>
        ) : null}
      </div>

      {view === "table" ? (
        <TableBox minWidth={900} head={["Request", "Member", "Space", "Timing", "Owner", "Stage", ""]} empty={!list.length && "No requests match."}>
          {list.map((i) => (
            <tr key={i.id} tabIndex={0} onClick={() => setOpenId(i.id)} onKeyDown={(e) => e.key === "Enter" && setOpenId(i.id)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-hover">
              <td className={td}><b className="block">{i.title}</b>{i.note ? <span className="line-clamp-1 text-faint">{i.note}</span> : null}</td>
              <td className={td}>{i.member}{i.company ? <span className="block text-faint">{i.company}</span> : null}</td>
              <td className={td}><ThreadTag thread={i.space} /></td>
              <td className={`${td} whitespace-nowrap text-muted`}>{i.meeting_at ? <>Meeting {formatDateTime(i.meeting_at)}</> : i.timing ? <>Asked {formatDateTime(i.timing)}</> : relativeWhen(i.created_at)}</td>
              <td className={`${td} text-muted`}>{i.owner ?? "Unassigned"}</td>
              <td className={td}><StatusPill tone={tone(i.status)}>{applicationLabel(i.status)}</StatusPill></td>
              <td className={td} onClick={(e) => e.stopPropagation()}>
                {next(i.status) && !(i.kind === "application" && next(i.status) === "won") ? (
                  <Button size="sm" variant="secondary" onClick={() => move(i, next(i.status)!)}>{applicationLabel(next(i.status)!)}<ChevronRight size={13} aria-hidden="true" /></Button>
                ) : null}
              </td>
            </tr>
          ))}
        </TableBox>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[1100px] grid-cols-5 gap-3">
            {APPLICATION_STATUSES.map((col) => {
              const cards = list.filter((i) => i.status === col.value);
              return (
                <section key={col.value} aria-label={col.label} className="flex flex-col gap-2 rounded-xl bg-hover p-2">
                  <header className="flex items-center justify-between px-1 text-[12px] font-extrabold tracking-wide text-faint uppercase"><span>{col.label}</span><span>{cards.length}</span></header>
                  {cards.length ? null : <span className="px-1 pb-1 text-[12.5px] text-faint">Nothing here.</span>}
                  {cards.map((i) => (
                    <button key={i.id} type="button" onClick={() => setOpenId(i.id)} className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-line bg-card p-2.5 text-left hover:border-line2">
                      <ThreadTag thread={i.space} />
                      <b className="text-[13.5px]">{i.title}</b>
                      <span className="text-[12px] text-faint">{i.member} · {i.meeting_at ? formatDateTime(i.meeting_at) : relativeWhen(i.created_at)}</span>
                      {i.note ? <span className="line-clamp-2 text-[12.5px] text-muted">“{i.note}”</span> : null}
                      <span className="text-[12px] text-faint">Owner: {i.owner ?? "Unassigned"}</span>
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Detail item={open} onClose={() => setOpenId(null)} base={base} onMove={move} onOwner={owner} />
    </>
  );
}

function Detail({
  item: i,
  onClose,
  base,
  onMove,
  onOwner,
}: {
  item: InboxItem | null;
  onClose: () => void;
  base: string;
  onMove: (i: InboxItem, s: ApplicationStatus) => void;
  onOwner: (i: InboxItem, o: string) => void;
}) {
  const r = useRunner();
  const [when, setWhen] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const key = i?.id ?? "";
  const [seen, setSeen] = useState("");
  if (i && seen !== key) {
    setSeen(key);
    setWhen(i.meeting_at ? isoToCairoLocal(i.meeting_at) : i.timing ? isoToCairoLocal(i.timing) : "");
    setUrl(i.meeting_url ?? "");
    setNote("");
    setAskDelete(false);
  }
  return (
    <Modal open={i !== null} onClose={onClose} eyebrow={i ? `${i.space} · ${i.kind === "request" ? "Meeting request" : "Application"}` : ""} title={i?.title ?? ""}>
      {i ? (
        <div className="flex flex-col gap-3 text-[13.5px]">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-faint">Member</dt>
            <dd><b>{i.member}</b>{i.email ? <> · <a className="font-bold text-link" href={`mailto:${i.email}`}>{i.email}</a></> : null}</dd>
            {i.company ? (<><dt className="text-faint">{i.kind === "request" ? "Company" : "Role"}</dt><dd>{i.company}</dd></>) : null}
            {i.timing ? (<><dt className="text-faint">Asked for</dt><dd>{formatDateTime(i.timing)}</dd></>) : null}
            <dt className="text-faint">Received</dt>
            <dd>{relativeWhen(i.created_at)}</dd>
          </dl>
          {i.note ? <p className="rounded-lg bg-hover p-2.5 whitespace-pre-line">{i.note}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12.5px] font-bold text-muted">
              Stage
              <select value={i.status} onChange={(e) => onMove(i, e.target.value as ApplicationStatus)} className="h-10 rounded-lg border border-line2 bg-card px-2 text-[13.5px] font-normal text-fg desk:h-9">
                {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-bold text-muted">
              Owner
              <select value={i.owner ?? ""} onChange={(e) => onOwner(i, e.target.value)} className="h-10 rounded-lg border border-line2 bg-card px-2 text-[13.5px] font-normal text-fg desk:h-9">
                {OWNERS.map((o) => <option key={o} value={o}>{o || "Unassigned"}</option>)}
              </select>
            </label>
          </div>

          {i.kind === "request" ? (
            <>
              <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-[12.5px] font-bold text-muted">Intro call</legend>
                {i.meeting_at ? <span className="text-[12.5px] text-faint">Confirmed for {formatDateTime(i.meeting_at)}. Change it below and the member gets a new email.</span> : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12.5px] font-bold text-muted">
                    Date and time (Cairo)
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-10 rounded-lg border border-line2 bg-card px-2 text-[13.5px] font-normal text-fg desk:h-9" />
                  </label>
                  <label className="flex flex-col gap-1 text-[12.5px] font-bold text-muted">
                    Google Meet link
                    <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/…" className="h-10 rounded-lg border border-line2 bg-card px-2 text-[13.5px] font-normal text-fg placeholder:text-faint desk:h-9" />
                  </label>
                </div>
                <Button size="sm" className="self-start" disabled={r.pending || !when} onClick={() => r.run(() => confirmMeeting(i.id, when, url))}>
                  {i.meeting_at ? "Update meeting" : "Confirm meeting"}
                </Button>
              </fieldset>
              <div className="flex flex-col gap-2">
                <span className="text-[12.5px] font-bold text-muted">Notes (partners only)</span>
                {i.notes.map((n) => (
                  <div key={n.id} className="flex items-start gap-2 rounded-lg bg-hover p-2.5 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] text-faint">{n.author} · {relativeWhen(n.created_at)}</span>
                      <p className="whitespace-pre-line">{n.body}</p>
                    </div>
                    <IconBtn label="Delete note" onClick={() => r.run(() => deleteRequestNote(n.id))}><Trash2 size={13} aria-hidden="true" /></IconBtn>
                  </div>
                ))}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Add a note for Ahmed and Karim" className="resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none" />
                <Button size="sm" variant="secondary" className="self-start" disabled={r.pending || !note.trim()} onClick={() => r.run(() => addRequestNote(i.id, note), () => setNote(""))}>Add note</Button>
              </div>
              <div className="border-t border-line pt-3">
                {askDelete ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px]">Delete this request for good?</span>
                    <Button size="sm" variant="danger" disabled={r.pending} onClick={() => r.run(() => deleteRequest(i.id), onClose)}>Delete</Button>
                    <Button size="sm" variant="secondary" onClick={() => setAskDelete(false)}>Keep it</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setAskDelete(true)}><Trash2 size={13} aria-hidden="true" />Delete request</Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-[12.5px] text-faint">
              Offer a seat and see the full answers in <Link href={`${base}/tvs?tab=apps`} className="font-bold text-link">TVS › Applications</Link>.
            </p>
          )}
          {r.error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{r.error}</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}
