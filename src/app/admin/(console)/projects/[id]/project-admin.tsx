"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, MessageSquare, Pencil, Pin, PinOff, Plus, Search, Trash2, UserPlus, Video } from "lucide-react";
import { loadPersonOptions } from "@/app/admin/(console)/access-actions";
import { ConfirmDelete, EditorDrawer, IconBtn, useRunner } from "@/components/admin/crud";
import { CommentThread, type ThreadComment } from "@/components/projects/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { MiniTag, StatusPill } from "@/components/ui/tag";
import type { PersonOption } from "@/lib/access";
import { formatDate, formatDateTime, isoToCairoLocal } from "@/lib/events/format";
import {
  formatMoney,
  MEETING_KINDS,
  meetingKindLabel,
  requestStatusLabel,
  requestTone,
  ROLE_LABEL,
  staffRequestMoves,
  type RequestStatus,
} from "@/lib/projects/format";
import type { Project, ProjectMeeting, ProjectNote, ProjectPerson, ProjectRequest, ScopeItem } from "@/lib/projects/queries";
import {
  addNote,
  addProjectPerson,
  addStaffComment,
  addTeamRequest,
  deleteMeeting,
  deleteNote,
  deleteProject,
  deleteRequest,
  deleteScopeItem,
  removeProjectPerson,
  respondToRequest,
  saveMeeting,
  saveProject,
  saveScopeItem,
  setNotePinned,
  setProjectPersonRole,
} from "../actions";
import { ProjectFields, type Option } from "../project-form";

/** Edit settings and delete, from the project header. */
export function ProjectHeaderActions({ project, portfolios, companies, base }: { project: Project; portfolios: Option[]; companies: Option[]; base: string }) {
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const r = useRunner();
  const router = useRouter();
  return (
    <>
      <span className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => { r.setError(null); setEdit(true); }}><Pencil size={14} aria-hidden="true" />Edit project</Button>
        <Button variant="ghost" onClick={() => setDel(true)}><Trash2 size={14} aria-hidden="true" />Delete</Button>
      </span>
      <EditorDrawer open={edit} onClose={() => setEdit(false)} eyebrow="BRICKR · Client project" title="Edit project" wide pending={r.pending} error={r.error} formKey={project.id} onSubmit={(fd) => r.run(() => saveProject(fd), () => setEdit(false))}>
        <ProjectFields p={project} portfolios={portfolios} companies={companies} />
      </EditorDrawer>
      <ConfirmDelete name={project.name} open={del} onClose={() => setDel(false)} pending={r.pending} note="This removes its people, scope, requests, meetings, comments and notes. Portfolios with ventures can't be deleted." onConfirm={() => r.run(() => deleteProject(project.id), () => router.push(`${base}/projects`))} />
    </>
  );
}

/** Client people: add from Contacts or by email, set lead / team, remove. */
export function PeoplePanel({ projectId, people, canManage, inherited }: { projectId: string; people: ProjectPerson[]; canManage: boolean; inherited: ProjectPerson[] }) {
  const [options, setOptions] = useState<PersonOption[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"lead" | "team">("team");
  const [loading, start] = useTransition();
  const r = useRunner();
  const load = () => { if (!options && !loading) start(async () => setOptions(await loadPersonOptions().catch(() => []))); };
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    const taken = new Set(people.map((p) => p.member_id ?? `e:${p.email}`));
    return (options ?? []).filter((o) => !taken.has(o.member_id ?? `e:${o.email}`) && (!needle || `${o.name} ${o.sub}`.toLowerCase().includes(needle))).slice(0, 8);
  }, [options, needle, people]);
  const typedEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.trim());
  return (
    <Card className="gap-3">
      <CardHeader title="Client people" />
      <p className="text-[12.5px] text-muted">Client leads accept the proposal and approve quotes; team members raise requests, comment and see meetings. People on a portfolio also see its ventures.</p>
      {people.length ? (
        <ul className="flex flex-col">
          {people.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-b-0">
              <span className="min-w-0 flex-1 text-[13.5px]"><b>{m.name}</b>{!m.member_id ? <span className="text-faint"> · invited ({m.email}), not joined yet</span> : null}</span>
              {canManage ? (
                <>
                  <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => r.run(() => setProjectPersonRole(m.id, e.target.value as "lead" | "team"))} className="h-9 rounded-lg border border-line2 bg-card px-2 text-[13px]">
                    <option value="lead">Client lead</option>
                    <option value="team">Team member</option>
                  </select>
                  <IconBtn label={`Remove ${m.name}`} onClick={() => r.run(() => removeProjectPerson(m.id))}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </>
              ) : <span className="text-[12.5px] text-faint">{ROLE_LABEL[m.role]}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-faint">Nobody from the client yet.</p>}
      {inherited.length ? <p className="text-[12.5px] text-faint">Also from the portfolio: {inherited.map((m) => `${m.name} (${ROLE_LABEL[m.role].toLowerCase()})`).join(", ")}</p> : null}
      {canManage ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-[12.5px] font-bold text-muted">
              Add someone
              <span className="relative">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden="true" />
                <input value={q} onFocus={load} onChange={(e) => setQ(e.target.value)} placeholder="Search members and contacts, or type an email" className="h-10 w-full rounded-lg border border-line2 bg-card pr-3 pl-8 text-[13.5px] desk:h-9" />
              </span>
            </label>
            <SelectField label="As" value={role} onChange={(e) => setRole(e.target.value as "lead" | "team")} options={[{ value: "team", label: "Team member" }, { value: "lead", label: "Client lead" }]} />
            {typedEmail ? <Button disabled={r.pending} onClick={() => r.run(() => addProjectPerson(projectId, { email: q.trim() }, role), () => setQ(""))}><UserPlus size={14} aria-hidden="true" />Invite {q.trim()}</Button> : null}
          </div>
          {loading ? <p className="text-[12.5px] text-faint">Loading people…</p> : null}
          {needle && matches.length ? (
            <ul className="flex flex-col rounded-xl border border-line">
              {matches.map((o) => (
                <li key={o.member_id ?? o.email}>
                  <button type="button" onClick={() => r.run(() => addProjectPerson(projectId, { member_id: o.member_id, email: o.email, name: o.name }, role), () => setQ(""))} className="flex w-full cursor-pointer items-center justify-between gap-2 border-b border-line px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-hover">
                    <span><b>{o.name}</b><br /><span className="text-faint">{o.sub}</span></span>
                    <UserPlus size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** Scope: what's included, by dimension. */
export function ScopePanel({ projectId, items, dimensions, canManage }: { projectId: string; items: ScopeItem[]; dimensions: string[]; canManage: boolean }) {
  const [edit, setEdit] = useState<ScopeItem | "new" | null>(null);
  const r = useRunner();
  const s = edit && edit !== "new" ? edit : null;
  return (
    <Card className="gap-3">
      <CardHeader title="Scope (what's included)" action={canManage ? <Button size="sm" variant="secondary" onClick={() => { r.setError(null); setEdit("new"); }}><Plus size={14} aria-hidden="true" />Add</Button> : undefined} />
      {items.length ? (
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 border-b border-line py-2.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                {it.dimension ? <span className="text-[11px] font-extrabold tracking-wide text-brk-fg uppercase">{it.dimension}</span> : null}
                <b className="block text-[14px]">{it.title}</b>
                {it.details ? <span className="block text-[13px] whitespace-pre-line text-muted">{it.details}</span> : null}
                {it.outputs.length ? <span className="mt-1 flex flex-wrap gap-1">{it.outputs.map((o) => <MiniTag key={o}>{o}</MiniTag>)}</span> : null}
              </span>
              {canManage ? (
                <span className="flex">
                  <IconBtn label={`Edit ${it.title}`} onClick={() => { r.setError(null); setEdit(it); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Remove ${it.title}`} onClick={() => r.run(() => deleteScopeItem(it.id))}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-faint">No scope items yet. Add the outputs from the proposal, by dimension.</p>}
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Project scope" title={s ? "Edit scope item" : "Add to the scope"} pending={r.pending} error={r.error} formKey={s?.id ?? "new"} onSubmit={(fd) => r.run(() => saveScopeItem(fd), () => setEdit(null))}>
        <input type="hidden" name="project_id" value={projectId} />
        {s ? <input type="hidden" name="id" value={s.id} /> : null}
        <SelectField label="Dimension" name="dimension" defaultValue={s?.dimension ?? dimensions[0] ?? ""} options={[{ value: "", label: "General" }, ...dimensions.map((d) => ({ value: d, label: d }))]} />
        <TextField label="Title" name="title" defaultValue={s?.title ?? ""} required maxLength={160} placeholder="Portfolio roadmap" />
        <TextArea label="Details" name="details" rows={3} defaultValue={s?.details ?? ""} maxLength={1500} placeholder="Priorities, sequencing and resources across the portfolio, reviewed every quarter." />
        <TextArea label="Outputs (one per line)" name="outputs" rows={3} defaultValue={s?.outputs.join("\n") ?? ""} placeholder={"Portfolio map\nPortfolio thesis\nOpportunity pipeline"} />
        <TextField label="Order" name="sort" type="number" min={0} max={1000} defaultValue={s?.sort ?? 100} />
      </EditorDrawer>
    </Card>
  );
}

const commentsOf = (all: ThreadComment[] & { target_type?: string }[], type: string, id: string | null) =>
  (all as (ThreadComment & { target_type: string; target_id: string | null })[]).filter((c) => c.target_type === type && c.target_id === id);

/** Requests: respond with a quote or decline, move work on, log verbal requests. */
export function RequestsPanel({ projectId, requests, comments, projectNames, canManage, defaultCurrency }: { projectId: string; requests: ProjectRequest[]; comments: (ThreadComment & { target_type: string; target_id: string | null })[]; projectNames: Record<string, string>; canManage: boolean; defaultCurrency: string }) {
  const [respond, setRespond] = useState<ProjectRequest | null>(null);
  const [next, setNext] = useState<RequestStatus>("quoted");
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<ProjectRequest | null>(null);
  const r = useRunner();
  const multi = Object.keys(projectNames).length > 1;
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[640px] text-[13px] text-muted">Requests beyond the scope are priced separately. Quote them (price, details, requirements, timeline) for the client lead to approve, or decline with a reason.</p>
        {canManage ? <Button size="sm" variant="secondary" onClick={() => { r.setError(null); setAdding(true); }}><Plus size={14} aria-hidden="true" />Log a verbal request</Button> : null}
      </div>
      {requests.length ? requests.map((q) => {
        const moves = staffRequestMoves(q);
        return (
          <Card key={q.id} className="gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="text-[15px]">{q.title}</b>
                <p className="text-[12.5px] text-faint">{multi ? `${projectNames[q.project_id]} · ` : ""}{q.source === "team" ? `Logged by ${q.raised_by_name}${q.received_note ? ` (${q.received_note})` : ""}` : `Raised by ${q.raised_by_name}`} · {formatDate(q.created_at)}</p>
              </div>
              <StatusPill tone={requestTone(q.status)}>{requestStatusLabel(q.status)}</StatusPill>
            </div>
            {q.details ? <p className="text-[13.5px] whitespace-pre-line text-muted">{q.details}</p> : null}
            {q.response || q.price !== null ? (
              <div className="flex flex-col gap-1 rounded-xl border border-line bg-hover/60 p-3 text-[13px]">
                {q.response ? <p className="whitespace-pre-line">{q.response}</p> : null}
                {q.requirements ? <p className="whitespace-pre-line text-muted"><b className="text-fg">Requirements:</b> {q.requirements}</p> : null}
                <p className="flex flex-wrap gap-x-4"><span><b>Price:</b> {q.price === 0 ? "Included" : formatMoney(q.price, q.currency)}</span>{q.timeline ? <span><b>Timeline:</b> {q.timeline}</span> : null}</p>
                {q.decided_at ? <p className="text-[12px] text-faint">{q.status === "client_declined" ? "Declined" : "Approved"} by {q.decided_by_name} on {formatDate(q.decided_at)}</p> : null}
              </div>
            ) : null}
            {q.decline_reason && q.status === "declined" ? <p className="rounded-xl bg-warn-bg px-3 py-2 text-[13px] text-warn-fg">{q.decline_reason}</p> : null}
            {canManage ? (
              <span className="flex flex-wrap items-center gap-2">
                {moves.length ? <Button size="sm" onClick={() => { r.setError(null); setNext(moves[0]); setRespond(q); }}>Respond / move</Button> : null}
                <IconBtn label={`Delete ${q.title}`} onClick={() => setDel(q)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
              </span>
            ) : null}
            <CommentThread compact staff comments={commentsOf(comments, "request", q.id)} post={(body, internal) => addStaffComment(q.project_id, { type: "request", id: q.id }, body, internal)} placeholder="Comment on this request" />
          </Card>
        );
      }) : <p className="rounded-xl border border-dashed border-line2 p-6 text-center text-[13.5px] text-faint">No requests yet.</p>}

      <Modal
        open={respond !== null}
        onClose={() => setRespond(null)}
        eyebrow="Request"
        title={respond?.title ?? ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRespond(null)}>Cancel</Button>
            <Button disabled={r.pending} onClick={() => form.current?.requestSubmit()}>{next === "quoted" ? "Send quote" : "Save"}</Button>
          </>
        }
      >
        {respond ? (
          <form ref={form} className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); r.run(() => respondToRequest(fd), () => setRespond(null)); }}>
            <input type="hidden" name="id" value={respond.id} />
            <SelectField label="Next step" name="status" value={next} onChange={(e) => setNext(e.target.value as RequestStatus)} options={staffRequestMoves(respond).map((m) => ({ value: m, label: m === "quoted" ? "Send a quote" : requestStatusLabel(m) }))} />
            {next === "quoted" ? (
              <>
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <TextField label="Price" name="price" inputMode="decimal" required defaultValue={respond.price ?? ""} placeholder="2500 (0 if included)" />
                  <SelectField label="Currency" name="currency" defaultValue={respond.price !== null ? respond.currency : defaultCurrency} options={["USD", "EGP"]} />
                </div>
                <TextArea label="What we'll do (details)" name="response" rows={4} required maxLength={4000} defaultValue={respond.response} />
                <TextArea label="What we need from the client (requirements)" name="requirements" rows={2} maxLength={2000} defaultValue={respond.requirements} />
                <TextField label="Timeline" name="timeline" maxLength={200} defaultValue={respond.timeline} placeholder="2 weeks from approval" />
                <p className="text-[12.5px] text-faint">The client lead is told in their bell and approves or declines in the app. With a price above 0, work starts after approval.</p>
              </>
            ) : null}
            {next === "declined" ? <TextArea label="Reason (the client sees this)" name="decline_reason" rows={3} required maxLength={1000} /> : null}
            {r.error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{r.error}</p> : null}
          </form>
        ) : null}
      </Modal>

      <EditorDrawer open={adding} onClose={() => setAdding(false)} eyebrow="Requests" title="Log a verbal request" pending={r.pending} error={r.error} formKey="add" onSubmit={(fd) => r.run(() => addTeamRequest(fd), () => setAdding(false))}>
        {multi ? (
          <SelectField label="For" name="project_id" defaultValue={projectId} options={Object.entries(projectNames).map(([value, label]) => ({ value, label }))} />
        ) : <input type="hidden" name="project_id" value={projectId} />}
        <TextField label="What did they ask for?" name="title" required maxLength={160} />
        <TextArea label="Details" name="details" rows={4} maxLength={4000} />
        <TextField label="How and when we received it" name="received_note" maxLength={300} placeholder="Verbal, weekly session on 12 Nov" />
        <p className="text-[12.5px] text-faint">The client team is told in their bell. Then respond with a quote for the client lead to approve.</p>
      </EditorDrawer>
      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={r.pending} onConfirm={() => del && r.run(() => deleteRequest(del.id), () => setDel(null))} />
    </div>
  );
}

/** Meetings: schedule (Cairo time), agenda, notes after, cancel. */
export function MeetingsPanel({ projectId, meetings, comments, projectNames, canManage }: { projectId: string; meetings: ProjectMeeting[]; comments: (ThreadComment & { target_type: string; target_id: string | null })[]; projectNames: Record<string, string>; canManage: boolean }) {
  const [edit, setEdit] = useState<ProjectMeeting | "new" | null>(null);
  const [del, setDel] = useState<ProjectMeeting | null>(null);
  const r = useRunner();
  const m = edit && edit !== "new" ? edit : null;
  const multi = Object.keys(projectNames).length > 1;
  return (
    <Card className="gap-3">
      <CardHeader title="Meetings" action={canManage ? <Button size="sm" variant="secondary" onClick={() => { r.setError(null); setEdit("new"); }}><Plus size={14} aria-hidden="true" />Schedule</Button> : undefined} />
      {meetings.length ? (
        <ul className="flex flex-col">
          {[...meetings].reverse().map((x) => (
            <li key={x.id} className="flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px]"><b>{x.title}</b> <span className="text-[12.5px] text-faint">· {meetingKindLabel(x.kind)}{multi ? ` · ${projectNames[x.project_id]}` : ""}{x.source === "calendly" ? " · booked in Calendly" : ""}</span></span>
                <span className="flex items-center gap-1">
                  <StatusPill tone={x.status === "done" ? "ok" : x.status === "cancelled" ? "draft" : "blue"}>{x.status === "done" ? "Done" : x.status === "cancelled" ? "Cancelled" : "Scheduled"}</StatusPill>
                  {canManage ? (
                    <>
                      <IconBtn label={`Edit ${x.title}`} onClick={() => { r.setError(null); setEdit(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                      <IconBtn label={`Delete ${x.title}`} onClick={() => setDel(x)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                    </>
                  ) : null}
                </span>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1"><CalendarClock size={14} aria-hidden="true" />{formatDateTime(x.starts_at)} (Cairo) · {x.minutes} min</span>
                {x.meet_url ? <a href={x.meet_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-link hover:underline"><Video size={14} aria-hidden="true" />Meeting link</a> : null}
              </p>
              {x.agenda ? <p className="text-[13px] whitespace-pre-line"><b>Agenda:</b> {x.agenda}</p> : null}
              {x.notes ? <p className="rounded-lg bg-hover px-3 py-2 text-[13px] whitespace-pre-line"><b>Notes:</b> {x.notes}</p> : null}
              <CommentThread compact staff comments={commentsOf(comments, "meeting", x.id)} post={(body, internal) => addStaffComment(x.project_id, { type: "meeting", id: x.id }, body, internal)} placeholder="Comment on this meeting" />
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-faint">No meetings yet. Schedule the kick-off.</p>}
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Meetings" title={m ? "Edit meeting" : "Schedule a meeting"} pending={r.pending} error={r.error} formKey={m?.id ?? "new"} onSubmit={(fd) => r.run(() => saveMeeting(fd), () => setEdit(null))}>
        <input type="hidden" name="project_id" value={m?.project_id ?? projectId} />
        {m ? <input type="hidden" name="id" value={m.id} /> : null}
        <TextField label="Title" name="title" required maxLength={160} defaultValue={m?.title ?? ""} placeholder="Weekly session: portfolio strategy" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Type" name="kind" defaultValue={m?.kind ?? "weekly"} options={MEETING_KINDS} />
          <SelectField label="Status" name="status" defaultValue={m?.status ?? "scheduled"} options={[{ value: "scheduled", label: "Scheduled" }, { value: "done", label: "Done" }, { value: "cancelled", label: "Cancelled" }]} />
          <TextField label="Date and time (Cairo)" name="starts_at" type="datetime-local" required defaultValue={m ? isoToCairoLocal(m.starts_at) : ""} />
          <TextField label="Length (minutes)" name="minutes" type="number" min={15} max={480} defaultValue={m?.minutes ?? 90} />
        </div>
        <TextField label="Meeting link (Google Meet)" name="meet_url" type="url" maxLength={300} defaultValue={m?.meet_url ?? ""} placeholder="https://meet.google.com/…" />
        <TextArea label="Agenda" name="agenda" rows={4} maxLength={3000} defaultValue={m?.agenda ?? ""} />
        <TextArea label="Notes after the meeting" name="notes" rows={4} maxLength={8000} defaultValue={m?.notes ?? ""} hint="The client team sees these notes." />
      </EditorDrawer>
      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="To keep it visible as cancelled, edit it and set the status to Cancelled instead." onConfirm={() => del && r.run(() => deleteMeeting(del.id), () => setDel(null))} />
    </Card>
  );
}

/** Partner notes: only the team sees them. */
export function NotesPanel({ projectId, notes, canManage }: { projectId: string; notes: ProjectNote[]; canManage: boolean }) {
  const [body, setBody] = useState("");
  const r = useRunner();
  return (
    <Card className="gap-3">
      <CardHeader title="Partner notes" action={<span className="text-[12px] text-faint">Team only</span>} />
      {canManage ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); r.run(() => addNote(projectId, body), () => setBody("")); }}>
          <TextArea label="New note" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} placeholder="Context, decisions, follow-ups…" />
          <Button type="submit" size="sm" className="self-start" disabled={r.pending || !body.trim()}>Save note</Button>
        </form>
      ) : null}
      {notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-xl border px-3 py-2 ${n.pinned ? "border-primary/40 bg-soft" : "border-line"}`}>
              <span className="flex items-center justify-between gap-2 text-[11.5px] text-faint">
                <span><b className="text-fg">{n.author}</b> · {formatDateTime(n.created_at)}</span>
                {canManage ? (
                  <span className="flex">
                    <IconBtn label={n.pinned ? "Unpin" : "Pin"} onClick={() => r.run(() => setNotePinned(n.id, !n.pinned))}>{n.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}</IconBtn>
                    <IconBtn label="Delete note" onClick={() => r.run(() => deleteNote(n.id))}><Trash2 size={14} aria-hidden="true" /></IconBtn>
                  </span>
                ) : null}
              </span>
              <p className="text-[13.5px] whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-faint">No notes yet.</p>}
    </Card>
  );
}

/** Project-wide conversation (shared or team only). */
export function ProjectComments({ projectId, comments }: { projectId: string; comments: (ThreadComment & { target_type: string; target_id: string | null })[] }) {
  return (
    <Card className="gap-3">
      <CardHeader title={<span className="inline-flex items-center gap-1.5"><MessageSquare size={16} aria-hidden="true" />Conversation</span>} />
      <CommentThread staff comments={commentsOf(comments, "project", null)} post={(body, internal) => addStaffComment(projectId, { type: "project", id: null }, body, internal)} placeholder="Message the client team (or tick Team only)" />
    </Card>
  );
}
