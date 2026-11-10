"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, TableBox, td, useRunner } from "@/components/admin/crud";
import { SelectField, TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { formatDate } from "@/lib/events/format";
import { COHORT_STATUSES } from "@/lib/tvs/format";
import type { Cohort } from "@/lib/tvs/queries";
import { deleteCohort, saveCohort } from "./actions";

export function CohortsManager({ cohorts, programs }: { cohorts: Cohort[]; programs: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<Cohort | "new" | null>(null);
  const [del, setDel] = useState<Cohort | null>(null);
  const { pending, error, setError, run } = useRunner();
  const c = editing && editing !== "new" ? editing : null;
  return (
    <>
      <ListBar count={cohorts.length} noun="cohorts" newLabel="New cohort" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox minWidth={680} head={["Cohort", "Program", "Starts", "Seats", "Status", ""]} empty={!cohorts.length && "No cohorts yet. Create one before offering seats."}>
        {cohorts.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={td}><b>{x.label}</b></td>
            <td className={td}>{x.program}</td>
            <td className={`${td} text-muted`}>{x.starts_on ? formatDate(x.starts_on + "T12:00:00Z") : "[DATE]"}</td>
            <td className={`${td} text-muted`}>{x.taken}{x.capacity ? ` of ${x.capacity}` : ""}</td>
            <td className={td}><StatusPill tone={x.status === "running" ? "ok" : x.status === "planned" ? "blue" : "draft"}>{COHORT_STATUSES.find((s) => s.value === x.status)?.label ?? x.status}</StatusPill></td>
            <td className={td}>
              <div className="flex justify-end gap-1">
                <IconBtn label={`Edit ${x.label}`} onClick={() => { setError(null); setEditing(x); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                <IconBtn label={`Delete ${x.label}`} onClick={() => setDel(x)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
              </div>
            </td>
          </tr>
        ))}
      </TableBox>
      <EditorDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="TVS · Cohort"
        title={c ? "Edit cohort" : "New cohort"}
        pending={pending}
        error={error}
        formKey={c?.id ?? "new"}
        onSubmit={(fd) => run(() => saveCohort(fd), () => setEditing(null))}
      >
        {c ? <input type="hidden" name="id" value={c.id} /> : null}
        <SelectField label="Program" name="program_id" defaultValue={c?.program_id ?? programs[0]?.id ?? ""} options={programs.map((p) => ({ value: p.id, label: p.name }))} />
        <TextField label="Name" name="label" defaultValue={c?.label ?? "Cohort [NO.]"} maxLength={60} hint="For example: Cohort 1, or Cohort 1 · Spring." />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Starts on" name="starts_on" type="date" defaultValue={c?.starts_on ?? ""} hint="Empty shows [DATE]." />
          <TextField label="Seats" name="capacity" type="number" min={1} max={1000} defaultValue={c?.capacity ?? ""} placeholder="No limit" />
        </div>
        <SelectField label="Status" name="status" defaultValue={c?.status ?? "planned"} options={COHORT_STATUSES} />
      </EditorDrawer>
      <ConfirmDelete name={del?.label} open={del !== null} onClose={() => setDel(null)} pending={pending} note="Cohorts with learners can't be deleted; set them to Finished instead." onConfirm={() => del && run(() => deleteCohort(del.id), () => setDel(null))} />
    </>
  );
}
