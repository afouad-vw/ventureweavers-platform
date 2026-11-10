"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, TableBox, td, useRunner } from "@/components/admin/crud";
import { TbaField } from "@/components/admin/detail-fields";
import { SelectField, TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { formatDate, formatEGP } from "@/lib/events/format";
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
      <TableBox minWidth={860} head={["Cohort", "Program", "Dates", "Format", "Seats", "Price", "Status", ""]} empty={!cohorts.length && "No cohorts yet. Create one before offering seats."}>
        {cohorts.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={td}><b>{x.label}</b></td>
            <td className={td}>{x.program}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{x.starts_on ? formatDate(x.starts_on + "T12:00:00Z") : "[DATE]"}{x.ends_on ? ` – ${formatDate(x.ends_on + "T12:00:00Z")}` : ""}</td>
            <td className={`${td} text-muted`}>{x.format ? `${x.format}${x.format === "In person" ? ` · ${x.location ?? "TBA"}` : x.meet_url ? " · Meet link set" : " · Meet TBA"}` : "—"}</td>
            <td className={`${td} text-muted`}>{x.taken}{x.capacity ? ` of ${x.capacity}` : ""}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{formatEGP(x.price_piasters)}</td>
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
          <TextField label="Start date" name="starts_on" type="date" defaultValue={c?.starts_on ?? ""} hint="Empty shows [DATE]." />
          <TextField label="End date" name="ends_on" type="date" defaultValue={c?.ends_on ?? ""} />
        </div>
        <FormatFields cohort={c} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Capacity (attendees)" name="capacity" type="number" min={1} max={1000} defaultValue={c?.capacity ?? ""} placeholder="No limit" />
          <TextField label="Price per seat (EGP)" name="price" inputMode="decimal" defaultValue={c?.price_piasters != null ? String(c.price_piasters / 100) : ""} placeholder="Empty = [PRICE]" hint="Used when you offer a seat." />
        </div>
        <SelectField label="Status" name="status" defaultValue={c?.status ?? "planned"} options={COHORT_STATUSES} />
      </EditorDrawer>
      <ConfirmDelete name={del?.label} open={del !== null} onClose={() => setDel(null)} pending={pending} note="Cohorts with learners can't be deleted; set them to Finished instead." onConfirm={() => del && run(() => deleteCohort(del.id), () => setDel(null))} />
    </>
  );
}

function FormatFields({ cohort }: { cohort: Cohort | null }) {
  const [format, setFormat] = useState<string>(cohort?.format ?? "Online");
  return (
    <>
      <SelectField label="Format" name="format" value={format} onChange={(e) => setFormat(e.target.value)} options={["Online", "In person"]} />
      {format === "In person" ? (
        <TbaField key="loc" name="location" label="Location" initial={cohort?.location ?? null} placeholder="Venue, area, Cairo" />
      ) : (
        <TbaField key="meet" name="meet_url" label="Google Meet link" initial={cohort?.meet_url ?? null} placeholder="https://meet.google.com/…" type="url" hint="Only enrolled learners see it." />
      )}
    </>
  );
}
