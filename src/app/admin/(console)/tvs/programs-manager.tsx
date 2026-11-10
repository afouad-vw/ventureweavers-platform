"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { ImageField } from "@/components/admin/image-field";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { formatEGP } from "@/lib/events/format";
import { PROGRAM_KINDS, PROGRAM_STATUSES } from "@/lib/tvs/format";
import type { AdminProgram } from "@/lib/tvs/queries";
import { deleteProgram, duplicateProgram, saveProgram, setProgramStatus } from "./actions";

const tone = (s: string) => (s === "open" ? "ok" : s === "in_development" ? "blue" : s === "closed" ? "warn" : "draft") as "ok" | "blue" | "warn" | "draft";
const label = (s: string) => PROGRAM_STATUSES.find((x) => x.value === s)?.label ?? s;
const priceInput = (p: number | null) => (p == null ? "" : String(p / 100));

export function ProgramsManager({ programs }: { programs: AdminProgram[] }) {
  const [editing, setEditing] = useState<AdminProgram | "new" | null>(null);
  const [del, setDel] = useState<AdminProgram | null>(null);
  const [interest, setInterest] = useState<AdminProgram | null>(null);
  const { pending, error, setError, run } = useRunner();
  const p = editing && editing !== "new" ? editing : null;

  return (
    <>
      <ListBar count={programs.length} noun="programs" newLabel="New program" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox minWidth={820} head={["Program", "Type", "Length", "Price", "Requires TVAC", "Status", "Actions"]} empty={!programs.length && "No programs yet."}>
        {programs.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{x.name}</b><span className="line-clamp-1 text-faint">{x.description}</span></td>
            <td className={td}>{x.kind}</td>
            <td className={`${td} text-muted`}>{x.weeks} weeks</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{formatEGP(x.price_piasters)}</td>
            <td className={td}>{x.requires_tvac ? "Yes" : "No"}</td>
            <td className={td}><StatusPill tone={tone(x.status)}>{label(x.status)}</StatusPill></td>
            <td className={td}>
              <RowActions
                name={x.name}
                published={x.status === "open" || x.status === "in_development"}
                onEdit={() => { setError(null); setEditing(x); }}
                onDuplicate={() => run(() => duplicateProgram(x.id))}
                onToggle={() => run(() => setProgramStatus(x.id, x.status === "open" || x.status === "in_development" ? "draft" : "open"))}
                onDelete={() => setDel(x)}
                extra={
                  x.interested.length ? (
                    <IconBtn label={`${x.interested.length} asked to be notified`} onClick={() => setInterest(x)}>
                      <span className="inline-flex items-center gap-0.5 text-[11.5px] font-bold"><Bell size={13} aria-hidden="true" />{x.interested.length}</span>
                    </IconBtn>
                  ) : null
                }
              />
            </td>
          </tr>
        ))}
      </TableBox>

      <EditorDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="TVS · Program"
        title={p ? "Edit program" : "New program"}
        pending={pending}
        error={error}
        formKey={p?.id ?? "new"}
        onSubmit={(fd) => run(() => saveProgram(fd), () => setEditing(null))}
      >
        {p ? <input type="hidden" name="id" value={p.id} /> : null}
        <TextField label="Name" name="name" defaultValue={p?.name ?? ""} required maxLength={80} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Type" name="kind" defaultValue={p?.kind ?? "360 program"} options={PROGRAM_KINDS} />
          <SelectField label="Status" name="status" defaultValue={p?.status ?? "draft"} options={PROGRAM_STATUSES} hint="Open takes applications (foundation) or shows dates; In development offers Notify me." />
        </div>
        <TextArea label="Description" name="description" rows={3} defaultValue={p?.description ?? ""} maxLength={600} />
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Length (weeks)" name="weeks" defaultValue={p?.weeks ?? "[N]"} maxLength={20} />
          <TextField label="Price (EGP)" name="price" inputMode="decimal" defaultValue={priceInput(p?.price_piasters ?? null)} placeholder="Empty = [PRICE]" />
          <TextField label="Order" name="sort" type="number" min={0} max={1000} defaultValue={p?.sort ?? 100} />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-[13px] font-bold">
          <input type="checkbox" name="requires_tvac" defaultChecked={p?.requires_tvac ?? true} className="h-[18px] w-[18px] accent-primary" />
          Requires TVAC first
        </label>
        <TextField label="Tags (comma separated)" name="tags" defaultValue={p?.tags.join(", ") ?? ""} placeholder="Founders, Cohort" />
        <ImageField name="banner_url" initial={p?.banner_url ?? null} />
        <SelectField label="Photo or pattern (used when no image is uploaded)" name="banner" defaultValue={p?.banner ?? "Room"} options={BANNER_OPTIONS} />
      </EditorDrawer>

      <ConfirmDelete name={del?.name} open={del !== null} onClose={() => setDel(null)} pending={pending} note="Programs with applications or cohorts can't be deleted; set them to Closed or Draft instead." onConfirm={() => del && run(() => deleteProgram(del.id), () => setDel(null))} />

      <Modal open={interest !== null} onClose={() => setInterest(null)} title={`Notify me · ${interest?.name ?? ""}`}>
        <ul className="flex flex-col">
          {interest?.interested.map((i) => (
            <li key={`${i.email}-${i.at}`} className="flex items-center justify-between gap-2 border-b border-line py-2 text-[13.5px] last:border-b-0">
              <b>{i.name}</b>
              <span className="text-faint">{i.email ?? ""}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12.5px] text-faint">Tell them when it opens from Publishing, or email them directly.</p>
      </Modal>
    </>
  );
}
