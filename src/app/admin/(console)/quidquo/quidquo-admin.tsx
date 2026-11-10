"use client";

import { useState } from "react";
import { Download, Pencil, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import type { LogEntry, Stage, WaitlistRow } from "@/lib/brickr/queries";
import { formatDate } from "@/lib/events/format";
import { addToWaitlist, deleteLog, deleteStage, duplicateLog, exportWaitlistCsv, removeFromWaitlist, saveLog, saveStage, setLogStatus } from "./actions";

const ROLES = ["Founder raising capital", "Investor or angel", "Ecosystem partner"];
const today = () => new Date().toISOString().slice(0, 10);

export function StagesManager({ stages }: { stages: Stage[] }) {
  const [edit, setEdit] = useState<Stage | "new" | null>(null);
  const [del, setDel] = useState<Stage | null>(null);
  const r = useRunner();
  const s = edit && edit !== "new" ? edit : null;
  return (
    <>
      <ListBar count={stages.length} noun="stages" newLabel="New stage" onNew={() => { r.setError(null); setEdit("new"); }} />
      <TableBox minWidth={600} head={["#", "Stage", "Progress", ""]} empty={!stages.length && "No stages yet."}>
        {stages.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={`${td} font-display`}>{x.position}</td>
            <td className={td}><b className="block">{x.name}</b><span className="text-faint">{x.description}</span></td>
            <td className={td}>
              <span className="flex min-w-[160px] items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full bg-qq" style={{ width: `${x.progress}%` }} /></span>
                <span className="text-faint">{x.progress}%</span>
              </span>
            </td>
            <td className={td}>
              <div className="flex justify-end gap-1">
                <IconBtn label={`Edit ${x.name}`} onClick={() => { r.setError(null); setEdit(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                <IconBtn label={`Delete ${x.name}`} onClick={() => setDel(x)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
              </div>
            </td>
          </tr>
        ))}
      </TableBox>
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="QuidQuo · Stage" title={s ? "Edit stage" : "New stage"} pending={r.pending} error={r.error} formKey={s?.id ?? "new"} onSubmit={(fd) => r.run(() => saveStage(fd), () => setEdit(null))}>
        {s ? <input type="hidden" name="id" value={s.id} /> : null}
        <TextField label="Name" name="name" defaultValue={s?.name ?? ""} required maxLength={60} />
        <TextArea label="What happens in this stage" name="description" rows={3} defaultValue={s?.description ?? ""} maxLength={300} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Progress (%)" name="progress" type="number" min={0} max={100} defaultValue={s?.progress ?? 0} />
          <TextField label="Order" name="position" type="number" min={1} max={50} defaultValue={s?.position ?? stages.length + 1} />
        </div>
      </EditorDrawer>
      <ConfirmDelete name={del?.name} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="Members stop seeing it on the QuidQuo page." onConfirm={() => del && r.run(() => deleteStage(del.id), () => setDel(null))} />
    </>
  );
}

export function LogManager({ entries }: { entries: LogEntry[] }) {
  const [edit, setEdit] = useState<LogEntry | "new" | null>(null);
  const [del, setDel] = useState<LogEntry | null>(null);
  const r = useRunner();
  const e = edit && edit !== "new" ? edit : null;
  return (
    <>
      <ListBar count={entries.length} noun="entries" newLabel="New entry" onNew={() => { r.setError(null); setEdit("new"); }} />
      <TableBox minWidth={640} head={["Date", "Entry", "Status", "Actions"]} empty={!entries.length && "No entries yet."}>
        {entries.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(x.entry_date + "T12:00:00Z")}</td>
            <td className={td}><b className="block">{x.title}</b><span className="line-clamp-1 text-faint">{x.body}</span></td>
            <td className={td}><StatusPill tone={x.status === "published" ? "ok" : "draft"}>{x.status === "published" ? "Published" : "Draft"}</StatusPill></td>
            <td className={td}>
              <RowActions
                name={x.title}
                published={x.status === "published"}
                onEdit={() => { r.setError(null); setEdit(x); }}
                onDuplicate={() => r.run(() => duplicateLog(x.id))}
                onToggle={() => r.run(() => setLogStatus(x.id, x.status === "published" ? "draft" : "published"))}
                onDelete={() => setDel(x)}
              />
            </td>
          </tr>
        ))}
      </TableBox>
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="QuidQuo · Build log" title={e ? "Edit entry" : "New entry"} pending={r.pending} error={r.error} formKey={e?.id ?? "new"} onSubmit={(fd) => r.run(() => saveLog(fd), () => setEdit(null))}>
        {e ? <input type="hidden" name="id" value={e.id} /> : null}
        <TextField label="Title" name="title" defaultValue={e?.title ?? ""} required maxLength={160} />
        <TextArea label="What happened" name="body" rows={4} defaultValue={e?.body ?? ""} maxLength={1000} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" name="entry_date" type="date" defaultValue={e?.entry_date ?? today()} required />
          <SelectField label="Status" name="status" defaultValue={e?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
        </div>
      </EditorDrawer>
      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={r.pending} onConfirm={() => del && r.run(() => deleteLog(del.id), () => setDel(null))} />
    </>
  );
}

export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<WaitlistRow | null>(null);
  const r = useRunner();
  const toast = useToast();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-faint">{rows.length} people · {rows.filter((x) => x.feedback_calls).length} open to feedback calls</span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await exportWaitlistCsv();
              if (!res.ok) return toast(res.error);
              const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
              Object.assign(document.createElement("a"), { href: url, download: `quidquo-waitlist-${today()}.csv` }).click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} aria-hidden="true" />
            Export CSV
          </Button>
          <Button onClick={() => { r.setError(null); setAdding(true); }}>Add person</Button>
        </div>
      </div>
      <TableBox minWidth={760} head={["Name", "Email", "Joined as", "Feedback calls", "Invited by", "Date", ""]} empty={!rows.length && "Nobody on the waitlist yet."}>
        {rows.map((w) => (
          <tr key={w.id} className="border-b border-line last:border-b-0">
            <td className={td}><b>{w.name}</b>{w.member ? null : <span className="block text-[12px] text-faint">Added by an admin</span>}</td>
            <td className={`${td} text-muted`}>{w.email ?? "—"}</td>
            <td className={td}>{w.role}</td>
            <td className={td}>{w.feedback_calls ? "Yes" : "No"}</td>
            <td className={`${td} text-muted`}>{w.invited_by ?? "—"}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(w.joined_at)}</td>
            <td className={td}><div className="flex justify-end"><IconBtn label={`Remove ${w.name}`} onClick={() => setDel(w)}><Trash2 size={15} aria-hidden="true" /></IconBtn></div></td>
          </tr>
        ))}
      </TableBox>
      <EditorDrawer open={adding} onClose={() => setAdding(false)} eyebrow="QuidQuo · Waitlist" title="Add person" pending={r.pending} error={r.error} formKey="add" onSubmit={(fd) => r.run(() => addToWaitlist(fd), () => setAdding(false))}>
        <TextField label="Full name" name="name" maxLength={120} />
        <TextField label="Email" name="email" type="email" required maxLength={200} />
        <SelectField label="Joined as" name="role" defaultValue={ROLES[1]} options={ROLES} />
        <label className="flex min-h-10 items-center gap-2 text-[13px] font-bold">
          <input type="checkbox" name="feedback_calls" defaultChecked className="h-[18px] w-[18px] accent-primary" />
          Open to feedback calls
        </label>
        <p className="text-[12.5px] text-faint">People added here don&apos;t get the waitlist Library level until they join with a member account.</p>
      </EditorDrawer>
      <ConfirmDelete name={del?.name} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="They can join again from the QuidQuo page." onConfirm={() => del && r.run(() => removeFromWaitlist(del.id), () => setDel(null))} />
    </>
  );
}
