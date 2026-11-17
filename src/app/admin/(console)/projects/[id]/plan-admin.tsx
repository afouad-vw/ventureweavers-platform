"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, ClipboardList, FolderOpen, History, Lock, Pencil, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, useRunner } from "@/components/admin/crud";
import { CommentThread, type ThreadComment } from "@/components/projects/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextArea, TextField, Toggle } from "@/components/ui/field";
import { MiniTag, StatusPill } from "@/components/ui/tag";
import { formatDate, formatDateTime } from "@/lib/events/format";
import {
  isOverdue,
  MILESTONE_STATUSES,
  milestoneStatusLabel,
  PRIORITIES,
  progressOf,
  PROJECT_STATUSES,
  projectStatusLabel,
  STATUS_PATH,
  TASK_STATUSES,
  taskStatusLabel,
  taskTone,
} from "@/lib/projects/format";
import type { Milestone, Project, ProjectPerson, ProjectTask, StatusChange, WeeklyUpdate } from "@/lib/projects/queries";
import { addMonthOnePlan, addStaffComment, deleteMilestone, deleteTask, deleteUpdate, saveMilestone, saveTask, saveUpdate, setFolderLink, setProjectStatus, setTaskStatus } from "../actions";

type Comments = (ThreadComment & { target_type: string; target_id: string | null })[];
const commentsOf = (all: Comments, type: string, id: string) => all.filter((c) => c.target_type === type && c.target_id === id);

/** Status: the usual path, a manual override, automatic moves on/off and the history. */
export function StatusPanel({ project, history, canManage }: { project: Project; history: StatusChange[]; canManage: boolean }) {
  const r = useRunner();
  const [showHistory, setShowHistory] = useState(false);
  const at = STATUS_PATH.indexOf(project.status);
  const off = at < 0;
  const hint = PROJECT_STATUSES.find((s) => s.value === project.status)?.hint;
  return (
    <Card className="gap-3">
      <CardHeader title="Status" action={<span className="inline-flex items-center gap-1 text-[12px] text-faint">{project.status_auto ? <><Zap size={13} aria-hidden="true" />Automatic</> : <><Lock size={13} aria-hidden="true" />Manual</>}</span>} />
      <ol className="flex flex-col gap-1.5" aria-label="Project path">
        {STATUS_PATH.map((s, i) => {
          const done = !off && i < at;
          const now = s === project.status;
          return (
            <li key={s} className={`flex items-center gap-2 text-[13px] ${now ? "font-extrabold text-fg" : done ? "text-muted" : "text-faint"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${now ? "border-primary bg-primary text-white" : done ? "border-primary/50 bg-soft text-soft-fg" : "border-line2"}`}>{done ? <Check size={11} aria-hidden="true" /> : i + 1}</span>
              {projectStatusLabel(s)}
            </li>
          );
        })}
      </ol>
      {off ? <p className="rounded-lg bg-warn-bg px-3 py-2 text-[13px] font-bold text-warn-fg">{projectStatusLabel(project.status)}</p> : null}
      {hint ? <p className="text-[12px] text-faint">{hint}</p> : null}
      {canManage ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <SelectField label="Change status" value={project.status} disabled={r.pending} onChange={(e) => r.run(() => setProjectStatus(project.id, e.target.value, project.status_auto))} options={PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          <Toggle label="Move automatically" checked={project.status_auto} disabled={r.pending} onChange={(e) => r.run(() => setProjectStatus(project.id, project.status, e.target.checked))} />
          <p className="text-[12px] text-faint">Automatic moves: proposal uploaded → Pending approval; client lead accepts → Approved; start date → Situation assessment; a month in → Active; a month before the end → Renewal due.</p>
        </div>
      ) : null}
      {history.length ? (
        <div className="border-t border-line pt-2">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-bold text-link"><History size={13} aria-hidden="true" />History<ChevronDown size={13} className={showHistory ? "rotate-180" : ""} aria-hidden="true" /></button>
          {showHistory ? (
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2">
                  <span>{h.from_status ? `${projectStatusLabel(h.from_status)} → ` : ""}<b>{projectStatusLabel(h.to_status)}</b></span>
                  <span className="shrink-0 text-faint">{h.auto ? "auto" : h.by ?? ""} · {formatDate(h.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** The project folder: any https link; Drive folders also show inside the client's page. */
export function FolderPanel({ projectId, url, canManage }: { projectId: string; url: string | null; canManage: boolean }) {
  const [value, setValue] = useState(url ?? "");
  const [editing, setEditing] = useState(!url);
  const r = useRunner();
  return (
    <Card className="gap-2">
      <CardHeader title="Project folder" action={url && canManage && !editing ? <IconBtn label="Change folder link" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /></IconBtn> : undefined} />
      {url && !editing ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold break-all text-link hover:underline"><FolderOpen size={15} className="shrink-0" aria-hidden="true" />Open the folder</a>
      ) : canManage ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); r.run(() => setFolderLink(projectId, value), () => setEditing(false)); }}>
          <TextField label="Folder link" type="url" value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} placeholder="https://drive.google.com/drive/folders/…" hint="Any https link (Google Drive, SharePoint, Dropbox). Share it with the client people first. Google Drive folders also show their files on the client's page." />
          <span className="flex gap-2">
            <Button type="submit" size="sm" disabled={r.pending}>Save link</Button>
            {url ? <Button type="button" size="sm" variant="ghost" onClick={() => { setValue(url); setEditing(false); }}>Cancel</Button> : null}
          </span>
        </form>
      ) : <p className="text-[13px] text-faint">No folder yet.</p>}
    </Card>
  );
}

type Option = { value: string; label: string };

/** Plan & tasks: milestones with their tasks, by dimension; our side or the client's; the Month 1 template. */
export function PlanPanel({ projectId, milestones, tasks, people, dimensions, comments, canManage, meetings, startsOn }: { projectId: string; milestones: Milestone[]; tasks: ProjectTask[]; people: ProjectPerson[]; dimensions: string[]; comments: Comments; canManage: boolean; meetings: Option[]; startsOn: string | null }) {
  const [editMs, setEditMs] = useState<Milestone | "new" | null>(null);
  const [editTask, setEditTask] = useState<ProjectTask | { milestone_id: string | null } | null>(null);
  const [delMs, setDelMs] = useState<Milestone | null>(null);
  const [delTask, setDelTask] = useState<ProjectTask | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const r = useRunner();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const own = tasks.filter((t) => t.project_id === projectId);
  const shown = own.filter((t) => filter === "all" ? true : filter === "open" ? t.status !== "done" : filter === "client" ? t.owner_side === "client" : filter === "overdue" ? isOverdue(t, today) : filter === "internal" ? t.internal : t.dimension === filter);
  const groups: { m: Milestone | null; items: ProjectTask[] }[] = [
    ...milestones.filter((m) => m.project_id === projectId).map((m) => ({ m, items: shown.filter((t) => t.milestone_id === m.id) })),
    { m: null, items: shown.filter((t) => !t.milestone_id || !milestones.some((m) => m.id === t.milestone_id)) },
  ].filter((g) => g.m || g.items.length);
  const progress = progressOf(own);
  const ms = editMs && editMs !== "new" ? editMs : null;
  const task = editTask && "id" in editTask ? editTask : null;
  const clientPeople = people.filter((p) => p.member_id);
  const byDim = dimensions.map((d) => ({ d, p: progressOf(own.filter((t) => t.dimension === d)) })).filter((x) => x.p !== null);

  return (
    <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[12.5px] font-bold text-muted">
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-lg border border-line2 bg-card px-2 text-[13px]">
              <option value="all">All tasks</option>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="client">Client side</option>
              <option value="internal">Team only</option>
              {dimensions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          {canManage ? (
            <span className="flex flex-wrap gap-2">
              {!milestones.some((m) => m.project_id === projectId) ? <Button size="sm" variant="secondary" disabled={r.pending} onClick={() => r.run(() => addMonthOnePlan(projectId))}><Sparkles size={14} aria-hidden="true" />Add Month 1 onboarding plan</Button> : null}
              <Button size="sm" variant="secondary" onClick={() => { r.setError(null); setEditMs("new"); }}><Plus size={14} aria-hidden="true" />Milestone</Button>
              <Button size="sm" onClick={() => { r.setError(null); setEditTask({ milestone_id: null }); }}><Plus size={14} aria-hidden="true" />Task</Button>
            </span>
          ) : null}
        </div>
        {groups.length ? groups.map(({ m, items }) => {
          const all = own.filter((t) => (m ? t.milestone_id === m.id : !t.milestone_id));
          const pct = progressOf(all);
          return (
            <Card key={m?.id ?? "none"} className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {m?.dimension ? <span className="text-[11px] font-extrabold tracking-wide text-brk-fg uppercase">{m.dimension}</span> : null}
                  <b className="block text-[15px]">{m ? m.title : "Other tasks"}</b>
                  {m ? <span className="text-[12.5px] text-faint">{milestoneStatusLabel(m.status)}{m.due_on ? ` · due ${formatDate(m.due_on)}` : ""}{pct !== null ? ` · ${pct}% done` : ""}</span> : null}
                </div>
                {canManage ? (
                  <span className="flex">
                    <IconBtn label="Add a task here" onClick={() => { r.setError(null); setEditTask({ milestone_id: m?.id ?? null }); }}><Plus size={15} aria-hidden="true" /></IconBtn>
                    {m ? <IconBtn label={`Edit ${m.title}`} onClick={() => { r.setError(null); setEditMs(m); }}><Pencil size={15} aria-hidden="true" /></IconBtn> : null}
                    {m ? <IconBtn label={`Delete ${m.title}`} onClick={() => setDelMs(m)}><Trash2 size={15} aria-hidden="true" /></IconBtn> : null}
                  </span>
                ) : null}
              </div>
              {pct !== null ? <div className="h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div> : null}
              {items.length ? (
                <ul className="flex flex-col">
                  {items.map((t) => (
                    <li key={t.id} className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-[13.5px]">
                          <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className={`cursor-pointer text-left font-bold hover:underline ${t.status === "done" ? "text-faint line-through" : ""}`}>{t.title}</button>
                          <span className="block text-[12px] text-faint">
                            {t.owner_side === "client" ? "Client" : "VentureWeavers"}{t.assignee ? ` · ${t.assignee}` : ""}{t.dimension ? ` · ${t.dimension}` : ""}
                            {t.due_on ? <span className={isOverdue(t, today) ? "font-bold text-bad-fg" : ""}> · due {formatDate(t.due_on)}</span> : null}
                            {t.priority === "high" ? " · high priority" : ""}
                          </span>
                        </span>
                        {t.internal ? <MiniTag>Team only</MiniTag> : null}
                        {canManage ? (
                          <>
                            <select aria-label={`Status of ${t.title}`} value={t.status} disabled={r.pending} onChange={(e) => r.run(() => setTaskStatus(t.id, e.target.value))} className="h-8 rounded-lg border border-line2 bg-card px-2 text-[12.5px]">
                              {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <IconBtn label={`Edit ${t.title}`} onClick={() => { r.setError(null); setEditTask(t); }}><Pencil size={14} aria-hidden="true" /></IconBtn>
                            <IconBtn label={`Delete ${t.title}`} onClick={() => setDelTask(t)}><Trash2 size={14} aria-hidden="true" /></IconBtn>
                          </>
                        ) : <StatusPill tone={taskTone(t.status)}>{taskStatusLabel(t.status)}</StatusPill>}
                      </div>
                      {open === t.id ? (
                        <div className="flex flex-col gap-2 pl-1">
                          {t.details ? <p className="text-[13px] whitespace-pre-line text-muted">{t.details}</p> : null}
                          <CommentThread compact staff comments={commentsOf(comments, "task", t.id)} post={(body, internal) => addStaffComment(t.project_id, { type: "task", id: t.id }, body, internal || t.internal)} placeholder="Comment on this task" />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-faint">No tasks{filter !== "all" ? " match this filter" : ""}.</p>}
            </Card>
          );
        }) : (
          <div className="rounded-xl border border-dashed border-line2 p-6 text-center text-[13.5px] text-faint">
            No plan yet. {canManage ? "Start with the Month 1 onboarding plan from the proposal, or add milestones and tasks." : ""}
          </div>
        )}
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <Card className="gap-2">
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><ClipboardList size={16} aria-hidden="true" />Progress</span>} />
          <p><b className="font-display text-[26px]">{progress ?? 0}%</b> <span className="text-[12.5px] text-faint">of {own.length} tasks done</span></p>
          <p className="text-[12.5px] text-muted">{own.filter((t) => t.status === "blocked").length} blocked · {own.filter((t) => isOverdue(t, today)).length} overdue · {own.filter((t) => t.owner_side === "client" && t.status !== "done").length} open on the client side</p>
          {byDim.length ? (
            <ul className="flex flex-col gap-1.5 border-t border-line pt-2">
              {byDim.map(({ d, p }) => (
                <li key={d} className="text-[12.5px]">
                  <span className="flex justify-between"><span>{d}</span><b>{p}%</b></span>
                  <div className="h-1 overflow-hidden rounded-full bg-hover" aria-hidden="true"><div className="h-full rounded-full bg-brk" style={{ width: `${p}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : null}
          {startsOn ? <p className="inline-flex items-center gap-1 text-[12px] text-faint"><CalendarDays size={13} aria-hidden="true" />Started {formatDate(startsOn)}</p> : null}
        </Card>
      </aside>

      <EditorDrawer open={editMs !== null} onClose={() => setEditMs(null)} eyebrow="Plan" title={ms ? "Edit milestone" : "Add a milestone"} pending={r.pending} error={r.error} formKey={ms?.id ?? "new"} onSubmit={(fd) => r.run(() => saveMilestone(fd), () => setEditMs(null))}>
        <input type="hidden" name="project_id" value={projectId} />
        {ms ? <input type="hidden" name="id" value={ms.id} /> : null}
        <TextField label="Title" name="title" required maxLength={160} defaultValue={ms?.title ?? ""} placeholder="Week 1: Portfolio strategy" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Dimension" name="dimension" defaultValue={ms?.dimension ?? ""} options={[{ value: "", label: "General" }, ...dimensions.map((d) => ({ value: d, label: d }))]} />
          <SelectField label="Status" name="status" defaultValue={ms?.status ?? "planned"} options={MILESTONE_STATUSES} />
          <TextField label="Due" name="due_on" type="date" defaultValue={ms?.due_on ?? ""} />
          <TextField label="Order" name="sort" type="number" min={0} max={10000} defaultValue={ms?.sort ?? (milestones.length + 1) * 10} />
        </div>
      </EditorDrawer>

      <EditorDrawer open={editTask !== null} onClose={() => setEditTask(null)} eyebrow="Plan" title={task ? "Edit task" : "Add a task"} pending={r.pending} error={r.error} formKey={task?.id ?? `new-${editTask?.milestone_id ?? ""}`} onSubmit={(fd) => r.run(() => saveTask(fd), () => setEditTask(null))}>
        <TaskFields projectId={projectId} task={task} milestoneId={editTask?.milestone_id ?? null} milestones={milestones.filter((m) => m.project_id === projectId)} dimensions={dimensions} people={clientPeople} meetings={meetings} />
      </EditorDrawer>
      <ConfirmDelete name={delMs?.title} open={delMs !== null} onClose={() => setDelMs(null)} pending={r.pending} note="Its tasks stay on the plan, without a milestone." onConfirm={() => delMs && r.run(() => deleteMilestone(delMs.id), () => setDelMs(null))} />
      <ConfirmDelete name={delTask?.title} open={delTask !== null} onClose={() => setDelTask(null)} pending={r.pending} onConfirm={() => delTask && r.run(() => deleteTask(delTask.id), () => setDelTask(null))} />
    </div>
  );
}

/** Fields for a task (also used for meeting action items). */
export function TaskFields({ projectId, task, milestoneId, milestones, dimensions, people, meetings, meetingId }: { projectId: string; task: ProjectTask | null; milestoneId?: string | null; milestones: Milestone[]; dimensions: string[]; people: ProjectPerson[]; meetings?: Option[]; meetingId?: string }) {
  const [side, setSide] = useState(task?.owner_side ?? "team");
  const [pick, setPick] = useState(task?.assignee_member ? `m:${task.assignee_member}` : "");
  const picked = people.find((p) => `m:${p.member_id}` === pick);
  return (
    <>
      <input type="hidden" name="project_id" value={task?.project_id ?? projectId} />
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      {meetingId ? <input type="hidden" name="meeting_id" value={meetingId} /> : null}
      <TextField label="Task" name="title" required maxLength={200} defaultValue={task?.title ?? ""} placeholder="Share last quarter's numbers for each venture" />
      <TextArea label="Details" name="details" rows={3} maxLength={4000} defaultValue={task?.details ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Whose task" name="owner_side" value={side} onChange={(e) => setSide(e.target.value as "team" | "client")} options={[{ value: "team", label: "VentureWeavers" }, { value: "client", label: "Client" }]} />
        {side === "client" && people.length ? (
          <SelectField label="Assignee" name="assignee_pick" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: "", label: "Anyone on the client team" }, ...people.map((p) => ({ value: `m:${p.member_id}`, label: p.name }))]} />
        ) : (
          <TextField label="Assignee" name="assignee" maxLength={120} defaultValue={task?.assignee_member ? "" : task?.assignee ?? ""} placeholder={side === "team" ? "Ahmed / Karim" : "Name"} />
        )}
        {picked ? <input type="hidden" name="assignee_name" value={picked.name} /> : null}
        <SelectField label="Milestone" name="milestone_id" defaultValue={task?.milestone_id ?? milestoneId ?? ""} options={[{ value: "", label: "None" }, ...milestones.map((m) => ({ value: m.id, label: m.title }))]} />
        <SelectField label="Dimension" name="dimension" defaultValue={task?.dimension ?? milestones.find((m) => m.id === milestoneId)?.dimension ?? ""} options={[{ value: "", label: "General" }, ...dimensions.map((d) => ({ value: d, label: d }))]} />
        <TextField label="Due" name="due_on" type="date" defaultValue={task?.due_on ?? ""} />
        <SelectField label="Status" name="status" defaultValue={task?.status ?? "todo"} options={TASK_STATUSES} />
        <SelectField label="Priority" name="priority" defaultValue={task?.priority ?? "normal"} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
        {!meetingId && meetings?.length ? <SelectField label="From meeting" name="meeting_id" defaultValue={task?.meeting_id ?? ""} options={[{ value: "", label: "None" }, ...meetings]} /> : null}
        <TextField label="Order" name="sort" type="number" min={0} max={10000} defaultValue={task?.sort ?? 100} />
      </div>
      {side === "team" ? <Toggle label="Team only (hidden from the client)" name="internal" defaultChecked={task?.internal ?? false} /> : <p className="text-[12.5px] text-faint">Client people see this task and can update its status. A named assignee is told in their bell.</p>}
    </>
  );
}

/** Weekly wrap-ups: draft, then publish to the client team. */
export function WrapUpsPanel({ projectId, updates, comments, canManage }: { projectId: string; updates: WeeklyUpdate[]; comments: Comments; canManage: boolean }) {
  const [edit, setEdit] = useState<WeeklyUpdate | "new" | null>(null);
  const [del, setDel] = useState<WeeklyUpdate | null>(null);
  const r = useRunner();
  const u = edit && edit !== "new" ? edit : null;
  const sunday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  })();
  return (
    <Card className="gap-3">
      <CardHeader title="Weekly wrap-ups" action={canManage ? <Button size="sm" variant="secondary" onClick={() => { r.setError(null); setEdit("new"); }}><Plus size={14} aria-hidden="true" />Write this week&apos;s</Button> : undefined} />
      {updates.length ? updates.map((w) => (
        <div key={w.id} className="flex flex-col gap-1.5 border-b border-line pb-3 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-[14px]">Week of {formatDate(w.week_of)}</b>
            <span className="flex items-center gap-1">
              <StatusPill tone={w.published_at ? "ok" : "draft"}>{w.published_at ? `Published ${formatDateTime(w.published_at)}` : "Draft"}</StatusPill>
              {canManage ? (
                <>
                  <IconBtn label="Edit wrap-up" onClick={() => { r.setError(null); setEdit(w); }}><Pencil size={14} aria-hidden="true" /></IconBtn>
                  <IconBtn label="Delete wrap-up" onClick={() => setDel(w)}><Trash2 size={14} aria-hidden="true" /></IconBtn>
                </>
              ) : null}
            </span>
          </div>
          <WrapUpBody w={w} />
          <CommentThread compact staff comments={commentsOf(comments, "update", w.id)} post={(body, internal) => addStaffComment(projectId, { type: "update", id: w.id }, body, internal)} placeholder="Comment on this wrap-up" />
        </div>
      )) : <p className="text-[13px] text-faint">No wrap-ups yet. Post one at the end of each week: what was done, what&apos;s next and open points.</p>}
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Weekly wrap-up" title={u ? "Edit wrap-up" : "This week's wrap-up"} wide pending={r.pending} error={r.error} formKey={u?.id ?? "new"} onSubmit={(fd) => r.run(() => saveUpdate(fd), () => setEdit(null))}>
        <input type="hidden" name="project_id" value={projectId} />
        {u ? <input type="hidden" name="id" value={u.id} /> : null}
        <TextField label="Week of" name="week_of" type="date" required defaultValue={u?.week_of ?? sunday} />
        <TextArea label="Summary" name="summary" rows={3} required maxLength={4000} defaultValue={u?.summary ?? ""} placeholder="Where things stand in two or three lines." />
        <TextArea label="Done this week" name="done" rows={4} maxLength={4000} defaultValue={u?.done ?? ""} />
        <TextArea label="Next week" name="next" rows={4} maxLength={4000} defaultValue={u?.next ?? ""} />
        <TextArea label="Open points and decisions needed" name="open_points" rows={3} maxLength={3000} defaultValue={u?.open_points ?? ""} />
        {u?.published_at ? <p className="text-[12.5px] text-faint">Already published; saving updates what the client sees.</p> : <Toggle label="Publish to the client team now (bell and email)" name="publish" value="1" />}
      </EditorDrawer>
      <ConfirmDelete name={del ? `the wrap-up for ${formatDate(del.week_of)}` : undefined} open={del !== null} onClose={() => setDel(null)} pending={r.pending} onConfirm={() => del && r.run(() => deleteUpdate(del.id), () => setDel(null))} />
    </Card>
  );
}

export function WrapUpBody({ w }: { w: WeeklyUpdate }) {
  return (
    <div className="flex flex-col gap-1.5 text-[13.5px]">
      <p className="whitespace-pre-line">{w.summary}</p>
      {w.done ? <p className="whitespace-pre-line text-muted"><b className="text-fg">Done:</b> {w.done}</p> : null}
      {w.next ? <p className="whitespace-pre-line text-muted"><b className="text-fg">Next:</b> {w.next}</p> : null}
      {w.open_points ? <p className="rounded-lg bg-warn-bg px-3 py-2 whitespace-pre-line text-warn-fg"><b>Open points:</b> {w.open_points}</p> : null}
    </div>
  );
}

