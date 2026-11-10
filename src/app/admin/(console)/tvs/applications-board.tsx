"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { IconBtn, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { relativeWhen } from "@/lib/content/format";
import { APPLICATION_STATUSES, nextStatus, previousStatus } from "@/lib/tvs/format";
import type { AdminApplication, Cohort } from "@/lib/tvs/queries";
import { deleteApplication, moveApplication, offerSeat, setApplicationOwner } from "./actions";

const OWNERS = ["", "Ahmed", "Karim"];

/** Admin › TVS › Applications: New → Intro call → Proposal → Won, or Declined. */
export function ApplicationsBoard({ applications, cohorts }: { applications: AdminApplication[]; cohorts: Cohort[] }) {
  const { pending, error, setError, run } = useRunner();
  const [view, setView] = useState<AdminApplication | null>(null);
  const [offer, setOffer] = useState<AdminApplication | null>(null);
  const [del, setDel] = useState<AdminApplication | null>(null);
  const offerRef = useRef<HTMLFormElement>(null);
  const offerCohorts = offer ? cohorts.filter((c) => c.program_id === offer.program_id && c.status !== "finished") : [];

  return (
    <>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {APPLICATION_STATUSES.map((col) => {
            const cards = applications.filter((a) => a.status === col.value);
            return (
              <section key={col.value} className="flex flex-col gap-2 rounded-xl bg-hover p-2" aria-label={col.label}>
                <header className="flex items-center justify-between px-1 text-[12px] font-extrabold tracking-wide text-faint uppercase">
                  <span>{col.label}</span>
                  <span>{cards.length}</span>
                </header>
                {cards.length ? null : <span className="px-1 pb-1 text-[12.5px] text-faint">Nothing here.</span>}
                {cards.map((a) => {
                  const next = nextStatus(a.status);
                  const prev = previousStatus(a.status);
                  return (
                    <article key={a.id} className="flex flex-col gap-1.5 glass vw-lift rounded-xl border p-2.5">
                      <b className="text-[13.5px]">{a.member}</b>
                      <span className="text-[12px] text-faint">{a.program} · {a.role}{a.venture_stage ? ` · ${a.venture_stage}` : ""}</span>
                      <span className="line-clamp-3 text-[12.5px] text-muted">“{a.building}”</span>
                      <span className="text-[12px] text-faint">{relativeWhen(a.created_at)}</span>
                      <label className="flex items-center gap-1.5 text-[12px] text-faint">
                        Owner
                        <select
                          defaultValue={a.owner ?? ""}
                          onChange={(e) => run(() => setApplicationOwner(a.id, e.target.value))}
                          className="h-8 flex-1 rounded-md border border-line2 bg-card px-1.5 text-[12.5px] text-fg"
                          aria-label={`Owner for ${a.member}`}
                        >
                          {OWNERS.map((o) => <option key={o} value={o}>{o || "Unassigned"}</option>)}
                        </select>
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        {prev ? <IconBtn label="Move back" onClick={() => run(() => moveApplication(a.id, prev))}><ChevronLeft size={15} aria-hidden="true" /></IconBtn> : null}
                        {next ? (
                          <Button size="sm" variant="secondary" onClick={() => run(() => moveApplication(a.id, next))}>
                            {APPLICATION_STATUSES.find((s) => s.value === next)?.label}
                            <ChevronRight size={13} aria-hidden="true" />
                          </Button>
                        ) : null}
                        {a.status !== "won" && a.status !== "declined" ? (
                          <Button size="sm" onClick={() => { setError(null); setOffer(a); }}>Offer seat</Button>
                        ) : null}
                        {a.status !== "won" && a.status !== "declined" ? <Button size="sm" variant="ghost" onClick={() => run(() => moveApplication(a.id, "declined"))}>Decline</Button> : null}
                        {a.status === "declined" ? <Button size="sm" variant="secondary" onClick={() => run(() => moveApplication(a.id, "new"))}>Reopen</Button> : null}
                        <span className="flex-1" />
                        <IconBtn label={`View ${a.member}'s application`} onClick={() => setView(a)}><Eye size={15} aria-hidden="true" /></IconBtn>
                        {a.status !== "won" ? <IconBtn label="Delete application" onClick={() => setDel(a)}><Trash2 size={15} aria-hidden="true" /></IconBtn> : null}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      <Modal open={view !== null} onClose={() => setView(null)} eyebrow={view?.program} title={view?.member ?? ""}>
        {view ? (
          <dl className="flex flex-col gap-2.5 text-[13.5px]">
            <div><dt className="text-[12px] text-faint">Email</dt><dd>{view.email ? <a className="font-bold text-link" href={`mailto:${view.email}`}>{view.email}</a> : "—"}</dd></div>
            <div><dt className="text-[12px] text-faint">Describes them</dt><dd>{view.role}{view.venture_stage ? ` · ${view.venture_stage}` : ""}</dd></div>
            <div><dt className="text-[12px] text-faint">Building</dt><dd className="whitespace-pre-line">{view.building}</dd></div>
            {view.why_now ? <div><dt className="text-[12px] text-faint">Why now</dt><dd className="whitespace-pre-line">{view.why_now}</dd></div> : null}
            <div><dt className="text-[12px] text-faint">Sent</dt><dd>{relativeWhen(view.created_at)}</dd></div>
          </dl>
        ) : null}
      </Modal>

      <Modal
        open={offer !== null}
        onClose={() => setOffer(null)}
        eyebrow="Offer a seat"
        title={offer ? `${offer.member} · ${offer.program}` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOffer(null)}>Cancel</Button>
            <Button disabled={pending || !offerCohorts.length} onClick={() => offerRef.current?.requestSubmit()}>Offer seat</Button>
          </>
        }
      >
        {offer ? (
          offerCohorts.length ? (
            <form
              ref={offerRef}
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(() => offerSeat(offer.id, String(fd.get("cohort_id")), String(fd.get("amount"))), () => setOffer(null));
              }}
            >
              <SelectField label="Cohort" name="cohort_id" defaultValue={offerCohorts[0].id} options={offerCohorts.map((c) => ({ value: c.id, label: `${c.label} · ${c.taken}${c.capacity ? ` of ${c.capacity}` : ""} seats` }))} />
              <TextField label="Amount (EGP)" name="amount" inputMode="decimal" required defaultValue={offer.price_piasters != null ? String(offer.price_piasters / 100) : ""} hint="0 for a sponsored seat (confirmed at once). Otherwise the member pays by bank transfer and you mark it paid in Learners." />
              <p className="text-[12.5px] text-faint">The application moves to Won and {offer.member} gets an email with the amount and payment reference.</p>
              {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
            </form>
          ) : (
            <p className="text-[13.5px]">There&apos;s no open cohort for {offer.program} yet. Create one in the Cohorts tab first.</p>
          )
        ) : null}
      </Modal>

      <Modal
        open={del !== null}
        onClose={() => setDel(null)}
        title="Delete this application?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDel(null)}>Keep it</Button>
            <Button variant="danger" disabled={pending} onClick={() => del && run(() => deleteApplication(del.id), () => setDel(null))}>Delete</Button>
          </>
        }
      >
        <p className="text-[13.5px]"><b>{del?.member}</b>&apos;s application is removed for good. To keep a record, Decline it instead.</p>
      </Modal>
    </>
  );
}
