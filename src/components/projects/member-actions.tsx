"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Plus, X } from "lucide-react";
import { acceptProposal, decideRequest, raiseRequest } from "@/app/(member)/projects/actions";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

/** "New request": something beyond the agreed scope. It's priced separately; the partners reply with a quote. */
export function RaiseRequestButton({ projectId, projects }: { projectId: string; projects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const toast = useToast();
  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}><Plus size={14} aria-hidden="true" />New request</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending} onClick={() => form.current?.requestSubmit()}>{pending ? "Sending…" : "Send request"}</Button>
          </>
        }
      >
        <form
          ref={form}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await raiseRequest(fd);
              if (r.ok) { toast(r.message); setOpen(false); } else setError(r.error);
            });
          }}
        >
          <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-soft-fg">Requests beyond the agreed scope are priced separately. We&apos;ll reply with the details, requirements, timeline and price for the client lead to approve.</p>
          {projects && projects.length > 1 ? (
            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-muted">
              For
              <select name="project_id" defaultValue={projectId} className="h-10 rounded-lg border border-line2 bg-card px-3 text-[13.5px] desk:h-9">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : (
            <input type="hidden" name="project_id" value={projectId} />
          )}
          <TextField label="What do you need?" name="title" required maxLength={160} placeholder="Review our investor deck before the roadshow" />
          <TextArea label="Details" name="details" rows={5} maxLength={4000} placeholder="Background, what good looks like, any deadline…" />
          {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}

/** The client lead's Approve / Decline on a quote. */
export function DecideButtons({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | boolean>(null);
  const toast = useToast();
  const go = (approve: boolean) =>
    start(async () => {
      const r = await decideRequest(requestId, approve);
      toast(r.ok ? r.message : r.error);
      setConfirm(null);
    });
  return (
    <>
      <span className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => setConfirm(true)}><CheckCircle2 size={14} aria-hidden="true" />Approve quote</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm(false)}><X size={14} aria-hidden="true" />Decline</Button>
      </span>
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? "Approve this quote?" : "Decline this quote?"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Back</Button>
            <Button disabled={pending} onClick={() => go(Boolean(confirm))}>{confirm ? "Approve" : "Decline"}</Button>
          </>
        }
      >
        <p className="text-[13.5px]">{confirm ? "The partners will start the work as described, and it's invoiced at the quoted price." : "The partners will be told. You can raise the request again later."}</p>
      </Modal>
    </>
  );
}

/** The client lead accepts the proposal. */
export function AcceptProposalButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><CheckCircle2 size={15} aria-hidden="true" />Accept proposal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Accept the proposal?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Back</Button>
            <Button disabled={pending} onClick={() => start(async () => { const r = await acceptProposal(projectId); toast(r.ok ? r.message : r.error); setOpen(false); })}>Accept</Button>
          </>
        }
      >
        <p className="text-[13.5px]">You confirm the scope, terms and investment in the proposal. Your name and the time are recorded.</p>
      </Modal>
    </>
  );
}
