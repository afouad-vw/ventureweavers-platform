"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, Download, Eye, EyeOff, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { PostForm } from "@/components/tvs/classroom-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { relativeWhen } from "@/lib/content/format";
import { formatDate, formatDateTime, isoToCairoLocal } from "@/lib/events/format";
import type { CAssignment, CFile, CModule, CPost, CSession, CStep, CSubmission } from "@/lib/tvs/classroom-queries";
import { uploadFile } from "@/lib/upload-client";
import {
  copyCurriculum,
  deleteAssignment,
  deleteCohortFile,
  deleteModule,
  deleteSession,
  deleteStep,
  openCohortFileAdmin,
  openSubmissionAdmin,
  reopenSubmission,
  reviewSubmission,
  saveAssignment,
  saveCohortFile,
  saveModule,
  saveSession,
  saveStep,
  setPostHidden,
} from "./classroom-actions";

export type AdminRoom = {
  cohortId: string;
  modules: CModule[];
  steps: CStep[];
  assignments: CAssignment[];
  submissions: (CSubmission & { member: string })[];
  sessions: CSession[];
  files: CFile[];
  posts: CPost[];
  learners: { member_id: string; name: string; pct: number; last: string | null }[];
  otherCohorts: { id: string; label: string }[];
};

const STEP_KINDS = [
  { value: "reading", label: "Reading" },
  { value: "case", label: "Case" },
  { value: "assignment", label: "Assignment" },
  { value: "library", label: "Library item" },
  { value: "video", label: "Video" },
  { value: "task", label: "Task" },
];
const day = (iso: string | null) => (iso ? isoToCairoLocal(iso).slice(0, 10) : "");
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`;

function useOpener() {
  const toast = useToast();
  const [, start] = useTransition();
  return (fn: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>) => {
    const tab = window.open("about:blank", "_blank");
    start(async () => {
      const r = await fn();
      if (r.ok && tab) {
        tab.opener = null;
        tab.location.href = r.url;
      } else {
        tab?.close();
        if (!r.ok) toast(r.error);
      }
    });
  };
}

export function ClassroomAdmin({ room }: { room: AdminRoom }) {
  return (
    <div className="flex flex-col gap-4">
      <Learners room={room} />
      <Modules room={room} />
      <Assignments room={room} />
      <Sessions room={room} />
      <Documents room={room} />
      <Discussion room={room} />
    </div>
  );
}

function Learners({ room }: { room: AdminRoom }) {
  const toReview = room.submissions.filter((s) => s.status === "submitted");
  return (
    <Card>
      <CardHeader title="Learners" action={<span className="font-normal text-faint">{toReview.length} hand-ins to review</span>} />
      {room.learners.length ? (
        <TableBox minWidth={560} head={["Learner", "Progress", "Last activity", "To review"]}>
          {room.learners.map((l) => (
            <tr key={l.member_id} className="border-b border-line last:border-b-0">
              <td className={td}><b>{l.name}</b></td>
              <td className={td}>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full bg-tvs" style={{ width: `${l.pct}%` }} /></span>
                  <span className="text-faint">{l.pct}%</span>
                </span>
              </td>
              <td className={`${td} text-muted`}>{l.last ? relativeWhen(l.last) : "—"}</td>
              <td className={td}>{toReview.filter((s) => s.member_id === l.member_id).length || "—"}</td>
            </tr>
          ))}
        </TableBox>
      ) : (
        <span className="text-[13px] text-faint">No confirmed learners yet.</span>
      )}
    </Card>
  );
}

function Modules({ room }: { room: AdminRoom }) {
  const [mod, setMod] = useState<CModule | "new" | null>(null);
  const [step, setStep] = useState<{ moduleId: string; s: CStep | null } | null>(null);
  const [del, setDel] = useState<{ kind: "module" | "step"; id: string; name: string } | null>(null);
  const [copyFrom, setCopyFrom] = useState(room.otherCohorts[0]?.id ?? "");
  const r = useRunner();
  const m = mod && mod !== "new" ? mod : null;
  const nextPos = (room.modules.at(-1)?.position ?? 0) + 1;
  return (
    <Card>
      <CardHeader
        title="Modules"
        action={
          <Button size="sm" onClick={() => { r.setError(null); setMod("new"); }}>
            <Plus size={14} aria-hidden="true" />
            New module
          </Button>
        }
      />
      {!room.modules.length && room.otherCohorts.length ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-hover p-3">
          <div className="min-w-[200px] flex-1">
            <SelectField label="Start from another cohort's modules" name="copy_from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} options={room.otherCohorts.map((c) => ({ value: c.id, label: c.label }))} />
          </div>
          <Button variant="secondary" disabled={r.pending || !copyFrom} onClick={() => r.run(() => copyCurriculum(copyFrom, room.cohortId))}>
            <Copy size={14} aria-hidden="true" />
            Copy modules
          </Button>
        </div>
      ) : null}
      {room.modules.length ? (
        <ul className="flex flex-col">
          {room.modules.map((x) => {
            const steps = room.steps.filter((s) => s.module_id === x.id);
            const open = x.opens_at && new Date(x.opens_at).getTime() <= Date.now();
            return (
              <li key={x.id} className="border-b border-line py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-tvs-bg text-[12px] font-extrabold text-tvs-fg">{x.position}</span>
                  <b className="min-w-0 flex-1 text-[14px]">{x.title}</b>
                  <StatusPill tone={open ? "ok" : x.opens_at ? "blue" : "draft"}>{open ? "Open" : x.opens_at ? `Opens ${formatDate(x.opens_at)}` : "No date"}</StatusPill>
                  <IconBtn label={`Edit ${x.title}`} onClick={() => { r.setError(null); setMod(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Delete ${x.title}`} onClick={() => setDel({ kind: "module", id: x.id, name: x.title })}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </div>
                <ul className="mt-1.5 flex flex-col gap-1 pl-9">
                  {steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-[13px]">
                      <span className="w-16 shrink-0 text-[11px] font-extrabold tracking-wide text-faint uppercase">{STEP_KINDS.find((k) => k.value === s.kind)?.label}</span>
                      <span className="min-w-0 flex-1 truncate">{s.title}{s.meta ? <span className="text-faint"> · {s.meta}</span> : null}</span>
                      <IconBtn label={`Edit step ${s.title}`} onClick={() => { r.setError(null); setStep({ moduleId: x.id, s }); }}><Pencil size={13} aria-hidden="true" /></IconBtn>
                      <IconBtn label={`Delete step ${s.title}`} onClick={() => setDel({ kind: "step", id: s.id, name: s.title })}><Trash2 size={13} aria-hidden="true" /></IconBtn>
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={() => { r.setError(null); setStep({ moduleId: x.id, s: null }); }} className="inline-flex h-8 cursor-pointer items-center gap-1 text-[12.5px] font-bold text-link hover:underline">
                      <Plus size={13} aria-hidden="true" />
                      Add step
                    </button>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
      ) : (
        <span className="text-[13px] text-faint">No modules yet.</span>
      )}

      <EditorDrawer open={mod !== null} onClose={() => setMod(null)} eyebrow="Classroom · Module" title={m ? "Edit module" : "New module"} pending={r.pending} error={r.error} formKey={m?.id ?? "new"} onSubmit={(fd) => r.run(() => saveModule(fd), () => setMod(null))}>
        {m ? <input type="hidden" name="id" value={m.id} /> : null}
        <input type="hidden" name="cohort_id" value={room.cohortId} />
        <TextField label="Title" name="title" defaultValue={m?.title ?? ""} required maxLength={120} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Order" name="position" type="number" min={1} max={100} defaultValue={m?.position ?? nextPos} />
          <TextField label="Opens on (Cairo)" name="opens_on" type="date" defaultValue={day(m?.opens_at ?? null)} hint="Empty: shows “Opens later”." />
        </div>
        <TextArea label="What this module is about" name="summary" rows={4} defaultValue={m?.summary ?? ""} maxLength={1000} />
      </EditorDrawer>

      <EditorDrawer open={step !== null} onClose={() => setStep(null)} eyebrow="Classroom · Step" title={step?.s ? "Edit step" : "New step"} pending={r.pending} error={r.error} formKey={step?.s?.id ?? `new-${step?.moduleId}`} onSubmit={(fd) => r.run(() => saveStep(fd), () => setStep(null))}>
        {step?.s ? <input type="hidden" name="id" value={step.s.id} /> : null}
        <input type="hidden" name="module_id" value={step?.moduleId ?? ""} />
        <TextField label="Title" name="title" defaultValue={step?.s?.title ?? ""} required maxLength={160} placeholder="Read: The customer behind the customer" />
        <div className="grid grid-cols-3 gap-3">
          <SelectField label="Kind" name="kind" defaultValue={step?.s?.kind ?? "reading"} options={STEP_KINDS} />
          <TextField label="Detail" name="meta" defaultValue={step?.s?.meta ?? ""} maxLength={60} placeholder="12 min" />
          <TextField label="Order" name="position" type="number" min={1} max={100} defaultValue={step?.s?.position ?? (room.steps.filter((s) => s.module_id === step?.moduleId).length + 1)} />
        </div>
        <TextField label="Link (optional)" name="url" defaultValue={step?.s?.url ?? ""} placeholder="/library or https://…" hint="A page in the app (like /library) or an https:// address. Documents go in the Documents section." />
      </EditorDrawer>

      <ConfirmDelete
        name={del?.name}
        open={del !== null}
        onClose={() => setDel(null)}
        pending={r.pending}
        note={del?.kind === "module" ? "Its steps, assignments and hand-ins are deleted too." : "Learners' ticks for it are removed."}
        onConfirm={() => del && r.run(() => (del.kind === "module" ? deleteModule(del.id) : deleteStep(del.id)), () => setDel(null))}
      />
    </Card>
  );
}

function Assignments({ room }: { room: AdminRoom }) {
  const [edit, setEdit] = useState<CAssignment | "new" | null>(null);
  const [del, setDel] = useState<CAssignment | null>(null);
  const [review, setReview] = useState<(CSubmission & { member: string }) | null>(null);
  const [feedback, setFeedback] = useState("");
  const r = useRunner();
  const open = useOpener();
  const a = edit && edit !== "new" ? edit : null;
  const modules = new Map(room.modules.map((m) => [m.id, m]));
  return (
    <Card>
      <CardHeader
        title="Assignments"
        action={
          <Button size="sm" disabled={!room.modules.length} onClick={() => { r.setError(null); setEdit("new"); }}>
            <Plus size={14} aria-hidden="true" />
            New assignment
          </Button>
        }
      />
      {room.assignments.length ? (
        <ul className="flex flex-col">
          {room.assignments.map((x) => {
            const subs = room.submissions.filter((s) => s.assignment_id === x.id);
            return (
              <li key={x.id} className="border-b border-line py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="min-w-0 flex-1 text-[14px]">{x.title}</b>
                  <span className="text-[12.5px] text-faint">Module {modules.get(x.module_id)?.position} · {x.due_at ? `due ${formatDateTime(x.due_at)}` : "no due date"} · {subs.length} handed in</span>
                  <IconBtn label={`Edit ${x.title}`} onClick={() => { r.setError(null); setEdit(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Delete ${x.title}`} onClick={() => setDel(x)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </div>
                {subs.length ? (
                  <ul className="mt-1.5 flex flex-col gap-1 pl-2">
                    {subs.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-hover px-2.5 py-1.5 text-[13px]">
                        <b className="min-w-[120px]">{s.member}</b>
                        <span className="min-w-0 flex-1 truncate text-faint">{s.file_name} · {mb(s.file_size)} · {relativeWhen(s.submitted_at)}</span>
                        <StatusPill tone={s.status === "reviewed" ? "ok" : "blue"}>{s.status === "reviewed" ? "Reviewed" : "Submitted"}</StatusPill>
                        <IconBtn label={`Download ${s.member}'s file`} onClick={() => open(() => openSubmissionAdmin(s.id))}><Download size={14} aria-hidden="true" /></IconBtn>
                        {s.status === "submitted" ? (
                          <Button size="sm" onClick={() => { setFeedback(""); setReview(s); }}>Review work</Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => r.run(() => reopenSubmission(s.id))}>Reopen</Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <span className="text-[13px] text-faint">{room.modules.length ? "No assignments yet." : "Add a module first."}</span>
      )}

      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Classroom · Assignment" title={a ? "Edit assignment" : "New assignment"} pending={r.pending} error={r.error} formKey={a?.id ?? "new"} onSubmit={(fd) => r.run(() => saveAssignment(fd), () => setEdit(null))}>
        {a ? <input type="hidden" name="id" value={a.id} /> : null}
        <TextField label="Title" name="title" defaultValue={a?.title ?? ""} required maxLength={160} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Module" name="module_id" defaultValue={a?.module_id ?? room.modules.at(-1)?.id ?? ""} options={room.modules.map((m) => ({ value: m.id, label: `${m.position}. ${m.title}` }))} />
          <TextField label="Due (Cairo)" name="due_at" type="datetime-local" defaultValue={a?.due_at ? isoToCairoLocal(a.due_at) : ""} />
        </div>
        <TextArea label="Brief" name="brief" rows={5} defaultValue={a?.brief ?? ""} maxLength={2000} hint="What to hand in and how it will be reviewed." />
      </EditorDrawer>

      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="Learners' hand-ins for it are deleted too." onConfirm={() => del && r.run(() => deleteAssignment(del.id), () => setDel(null))} />

      <Modal
        open={review !== null}
        onClose={() => setReview(null)}
        eyebrow="Review work"
        title={review ? `${review.member} · ${room.assignments.find((x) => x.id === review.assignment_id)?.title ?? ""}` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>Cancel</Button>
            <Button disabled={r.pending || feedback.trim().length < 2} onClick={() => review && r.run(() => reviewSubmission(review.id, feedback), () => setReview(null))}>Send feedback</Button>
          </>
        }
      >
        {review ? (
          <div className="flex flex-col gap-3">
            <Button variant="secondary" size="sm" className="self-start" onClick={() => open(() => openSubmissionAdmin(review.id))}>
              <Download size={14} aria-hidden="true" />
              {review.file_name}
            </Button>
            <TextArea label="Feedback" name="feedback" rows={6} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={4000} hint="The learner sees this under the assignment and gets an email. Reviewed work is locked unless you reopen it." />
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

function Sessions({ room }: { room: AdminRoom }) {
  const [edit, setEdit] = useState<CSession | "new" | null>(null);
  const [del, setDel] = useState<CSession | null>(null);
  const r = useRunner();
  const s = edit && edit !== "new" ? edit : null;
  return (
    <Card>
      <CardHeader title="Live sessions · Google Meet" action={<Button size="sm" onClick={() => { r.setError(null); setEdit("new"); }}><Plus size={14} aria-hidden="true" />Schedule session</Button>} />
      {room.sessions.length ? (
        <TableBox minWidth={680} head={["Session", "When", "Meet", "Recording", ""]}>
          {room.sessions.map((x) => {
            const past = new Date(x.starts_at).getTime() + 2 * 3600000 < Date.now();
            return (
              <tr key={x.id} className="border-b border-line last:border-b-0">
                <td className={td}><b>{x.title}</b></td>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(x.starts_at)}</td>
                <td className={`${td} text-muted`}>{x.meet_url ? <span className="block max-w-[200px] truncate">{x.meet_url.replace(/^https:\/\//, "")}</span> : "—"}</td>
                <td className={td}>{past ? (x.recording_url ? <StatusPill tone="ok">{x.recording_note || "Linked"}</StatusPill> : <StatusPill tone="warn">Add link</StatusPill>) : <StatusPill tone="blue">Upcoming</StatusPill>}</td>
                <td className={td}>
                  <div className="flex justify-end gap-1">
                    <IconBtn label={`Edit ${x.title}`} onClick={() => { r.setError(null); setEdit(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                    <IconBtn label={`Delete ${x.title}`} onClick={() => setDel(x)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                  </div>
                </td>
              </tr>
            );
          })}
        </TableBox>
      ) : (
        <span className="text-[13px] text-faint">No sessions yet.</span>
      )}
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Classroom · Live session" title={s ? "Edit session" : "Schedule session"} pending={r.pending} error={r.error} formKey={s?.id ?? "new"} onSubmit={(fd) => r.run(() => saveSession(fd), () => setEdit(null))}>
        {s ? <input type="hidden" name="id" value={s.id} /> : null}
        <input type="hidden" name="cohort_id" value={room.cohortId} />
        <TextField label="Title" name="title" defaultValue={s?.title ?? ""} required maxLength={160} placeholder="Module 3 · Customer & market workshop" />
        <TextField label="Date and time (Cairo)" name="starts_at" type="datetime-local" defaultValue={s ? isoToCairoLocal(s.starts_at) : ""} required />
        <TextField label="Google Meet link" name="meet_url" type="url" defaultValue={s?.meet_url ?? ""} placeholder="https://meet.google.com/…" hint="Create the event in Google Calendar and paste its Meet link. Only this cohort's learners see it." />
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <TextField label="Recording link" name="recording_url" type="url" defaultValue={s?.recording_url ?? ""} placeholder="YouTube (unlisted) or Google Drive" />
          <TextField label="Length" name="recording_note" defaultValue={s?.recording_note ?? ""} maxLength={40} placeholder="1h 25m" />
        </div>
      </EditorDrawer>
      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={r.pending} onConfirm={() => del && r.run(() => deleteSession(del.id), () => setDel(null))} />
    </Card>
  );
}

function Documents({ room }: { room: AdminRoom }) {
  const [edit, setEdit] = useState<CFile | "new" | null>(null);
  const [del, setDel] = useState<CFile | null>(null);
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [uploading, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const r = useRunner();
  const open = useOpener();
  const f = edit && edit !== "new" ? edit : null;
  const modules = new Map(room.modules.map((m) => [m.id, m]));
  return (
    <Card>
      <CardHeader title="Documents" action={<Button size="sm" onClick={() => { r.setError(null); setFile(null); setNote(null); setEdit("new"); }}><Plus size={14} aria-hidden="true" />Upload document</Button>} />
      {room.files.length ? (
        <TableBox minWidth={620} head={["Document", "Module", "Size", ""]}>
          {room.files.map((x) => (
            <tr key={x.id} className="border-b border-line last:border-b-0">
              <td className={td}><b className="block">{x.title}</b><span className="text-faint">{x.file_name}{x.note ? ` · ${x.note}` : ""}</span></td>
              <td className={`${td} text-muted`}>{x.module_id && modules.get(x.module_id) ? `Module ${modules.get(x.module_id)!.position}` : "—"}</td>
              <td className={`${td} text-muted`}>{mb(x.file_size)}</td>
              <td className={td}>
                <div className="flex justify-end gap-1">
                  <IconBtn label={`Download ${x.title}`} onClick={() => open(() => openCohortFileAdmin(x.id))}><Download size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Edit ${x.title}`} onClick={() => { r.setError(null); setEdit(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Delete ${x.title}`} onClick={() => setDel(x)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </TableBox>
      ) : (
        <span className="text-[13px] text-faint">No documents yet.</span>
      )}
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Classroom · Document" title={f ? "Edit document" : "Upload document"} pending={r.pending || uploading} error={r.error} formKey={f?.id ?? "new"} onSubmit={(fd) => r.run(() => saveCohortFile(fd), () => setEdit(null))}>
        {f ? <input type="hidden" name="id" value={f.id} /> : null}
        <input type="hidden" name="cohort_id" value={room.cohortId} />
        {!f ? (
          <div className="flex flex-col gap-1.5">
            <input type="hidden" name="file_path" value={file?.path ?? ""} />
            <input type="hidden" name="file_name" value={file?.name ?? ""} />
            <input type="hidden" name="file_size" value={file?.size ?? ""} />
            {file ? <span className="rounded-lg bg-hover px-2.5 py-2 text-[13px]"><b>{file.name}</b> · {mb(file.size)}</span> : null}
            <Button variant="secondary" size="sm" className="self-start" disabled={uploading} onClick={() => input.current?.click()}>
              <FileUp size={14} aria-hidden="true" />
              {uploading ? "Uploading…" : file ? "Replace file" : "Choose file"}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (!picked) return;
                setNote(null);
                start(async () => {
                  const res = await uploadFile("cohort-files", picked);
                  if (res.ok) setFile({ path: res.file.path, name: res.file.fileName, size: res.file.size });
                  else setNote(res.error);
                  if (input.current) input.current.value = "";
                });
              }}
            />
            <span className="text-[12px] text-faint">PDF, Word, Excel, PowerPoint or ZIP, up to 20 MB. Private to this cohort.</span>
            {note ? <span role="alert" className="text-[12.5px] font-bold text-bad-fg">{note}</span> : null}
          </div>
        ) : null}
        <TextField label="Title" name="title" defaultValue={f?.title ?? file?.name.replace(/\.[^.]+$/, "") ?? ""} required maxLength={160} key={file?.path ?? "t"} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Module" name="module_id" defaultValue={f?.module_id ?? ""} options={[{ value: "", label: "None" }, ...room.modules.map((m) => ({ value: m.id, label: `${m.position}. ${m.title}` }))]} />
          <TextField label="Note" name="note" defaultValue={f?.note ?? ""} maxLength={80} placeholder="Module 3 reading" />
        </div>
      </EditorDrawer>
      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="The file is deleted from storage too." onConfirm={() => del && r.run(() => deleteCohortFile(del.id), () => setDel(null))} />
    </Card>
  );
}

function Discussion({ room }: { room: AdminRoom }) {
  const r = useRunner();
  return (
    <Card>
      <CardHeader title="Cohort discussion" action={<span className="font-normal text-faint">Your posts show as Host</span>} />
      {room.posts.length ? (
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
          {room.posts.map((p) => (
            <li key={p.id} className={`rounded-lg p-2.5 text-[13px] ${p.is_host ? "bg-tvs-bg" : "bg-hover"} ${p.removed_at ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <b>{p.author}{p.removed_at ? " · hidden" : ""}</b>
                <span className="flex items-center gap-1 text-[11.5px] text-faint">
                  {relativeWhen(p.created_at)}
                  <IconBtn label={p.removed_at ? "Show to learners" : "Hide from learners"} onClick={() => r.run(() => setPostHidden(p.id, !p.removed_at))}>
                    {p.removed_at ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
                  </IconBtn>
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-line">{p.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-faint">No posts yet.</span>
      )}
      <PostForm cohortId={room.cohortId} />
    </Card>
  );
}
