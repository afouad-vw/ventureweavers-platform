"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { acceptProposal, addSharedNote, decideRequest, deleteMyNote, inviteTeamMember, raiseRequest, removeTeamMember, setMyTaskStatus } from "@/app/(member)/projects/actions";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { REQUEST_CATEGORIES, ROLE_LABEL, TASK_STATUSES, type ProjectRole } from "@/lib/projects/format";

/** "New request": extra work or a scope change (quoted), a meeting or call, a question, a document, or other. */
export function RaiseRequestButton({ projectId, projects, initial = "extra_work", label = "New request" }: { projectId: string; projects?: { id: string; name: string }[]; initial?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(initial);
  const cat = REQUEST_CATEGORIES.find((c) => c.value === category) ?? REQUEST_CATEGORIES[0];
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const toast = useToast();
  return (
    <>
      <Button size="sm" variant={initial === "meeting" ? "secondary" : "primary"} onClick={() => { setError(null); setCategory(initial); setOpen(true); }}><Plus size={14} aria-hidden="true" />{label}</Button>
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
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-bold text-muted">What kind of request?</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {REQUEST_CATEGORIES.map((c) => (
                <label key={c.value} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${category === c.value ? "border-primary bg-soft font-bold" : "border-line2"}`}>
                  <input type="radio" name="category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} className="accent-primary" />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-soft-fg">{cat.priced ? "Requests beyond the agreed scope are priced separately. We'll reply with the details, requirements, timeline and price for the client lead to approve." : cat.hint}</p>
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
          <TextField label={category === "meeting" ? "What's the meeting about?" : category === "question" ? "Your question" : "What do you need?"} name="title" required maxLength={160} placeholder={category === "meeting" ? "Call about the pricing model" : category === "question" ? "Should we raise before or after the launch?" : "Review our investor deck before the roadshow"} />
          <TextArea label="Details" name="details" rows={4} maxLength={4000} placeholder="Background, what good looks like, any deadline…" />
          {category === "meeting" ? <TextField label="Preferred times" name="preferred_times" maxLength={300} placeholder="Sunday or Monday afternoon, 45 minutes" /> : null}
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

/** Client people update their own tasks' status. */
export function TaskStatusSelect({ taskId, status, title }: { taskId: string; status: string; title: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <select
      aria-label={`Status of ${title}`}
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => { const r = await setMyTaskStatus(taskId, v); toast(r.ok ? r.message : r.error); });
      }}
      className="h-9 rounded-lg border border-line2 bg-card px-2 text-[13px]"
    >
      {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}

/** A shared note from the client team (the partners and everyone on the project see it). */
export function SharedNoteForm({ projectId }: { projectId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => { const r = await addSharedNote(projectId, body); toast(r.ok ? r.message : r.error); if (r.ok) setBody(""); });
      }}
    >
      <TextArea label="Add a note" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} placeholder="Context, decisions or reminders for everyone on the project" />
      <Button type="submit" size="sm" className="self-start" disabled={pending || !body.trim()}>Save note</Button>
    </form>
  );
}

export function DeleteNoteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button type="button" aria-label="Delete note" disabled={pending} onClick={() => start(async () => { const r = await deleteMyNote(id); toast(r.ok ? r.message : r.error); })} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg">
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}

/** People on the project; client leads add team members by email and remove them. */
export function TeamPeople({ projectId, people, lead, myId }: { projectId: string; people: { id: string; name: string; role: ProjectRole; member_id: string | null; email: string | null; project_id: string }[]; lead: boolean; myId: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5 text-[13px]">
        <li className="flex justify-between gap-2"><b>Ahmed Fouad &amp; Karim Hemdan</b><span className="text-faint">Partners</span></li>
        {people.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0">{m.name}{m.member_id === myId ? " (you)" : ""}{!m.member_id ? <span className="text-faint"> · invited</span> : null}</span>
            <span className="flex shrink-0 items-center gap-1 text-faint">
              {ROLE_LABEL[m.role]}
              {lead && m.role === "team" && m.project_id === projectId ? (
                <button type="button" aria-label={`Remove ${m.name}`} disabled={pending} onClick={() => start(async () => { const r = await removeTeamMember(m.id); toast(r.ok ? r.message : r.error); })} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg hover:bg-hover hover:text-fg"><Trash2 size={14} aria-hidden="true" /></button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {lead ? (
        adding ? (
          <form
            className="flex flex-col gap-2 border-t border-line pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await inviteTeamMember(projectId, email, name);
                toast(r.ok ? r.message : r.error);
                if (r.ok) { setEmail(""); setName(""); setAdding(false); }
              });
            }}
          >
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="name@company.com" />
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            <p className="text-[12px] text-faint">They join as a team member: they see the project, raise requests, update their tasks and add notes. Only the partners can make someone a client lead.</p>
            <span className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>Add to the project</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </span>
          </form>
        ) : (
          <Button size="sm" variant="secondary" className="self-start" onClick={() => setAdding(true)}><UserPlus size={14} aria-hidden="true" />Add someone</Button>
        )
      ) : null}
    </div>
  );
}
