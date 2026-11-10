"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { BrochureField, MarkdownField, OutlineEditor, PeopleEditor } from "@/components/admin/detail-fields";
import { ImageField } from "@/components/admin/image-field";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { formatHours, totalHours } from "@/lib/details";
import { PROGRAM_KINDS, PROGRAM_STATUSES } from "@/lib/tvs/format";
import type { AdminProgram } from "@/lib/tvs/queries";
import { deleteProgram, duplicateProgram, saveProgram, setProgramStatus } from "./actions";

const tone = (s: string) => (s === "open" ? "ok" : s === "in_development" ? "blue" : s === "closed" ? "warn" : "draft") as "ok" | "blue" | "warn" | "draft";
const label = (s: string) => PROGRAM_STATUSES.find((x) => x.value === s)?.label ?? s;

export function ProgramsManager({ programs }: { programs: AdminProgram[] }) {
  const [editing, setEditing] = useState<AdminProgram | "new" | null>(null);
  const [del, setDel] = useState<AdminProgram | null>(null);
  const [interest, setInterest] = useState<AdminProgram | null>(null);
  const { pending, error, setError, run } = useRunner();
  const p = editing && editing !== "new" ? editing : null;

  return (
    <>
      <ListBar count={programs.length} noun="programs" newLabel="New program" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox minWidth={820} head={["Program", "Type", "Length", "Outline", "Requires TVAC", "Status", "Actions"]} empty={!programs.length && "No programs yet."}>
        {programs.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{x.name}</b><span className="line-clamp-1 text-faint">{x.short_description || x.description}</span></td>
            <td className={td}>{x.kind}</td>
            <td className={`${td} text-muted`}>{x.weeks} weeks</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{x.outline.length ? `${x.outline.length} sessions · ${formatHours(totalHours(x.outline))}` : "—"}</td>
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
        wide
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
        <TextArea label="Short description" name="short_description" rows={2} defaultValue={p?.short_description || p?.description || ""} maxLength={300} required hint="Shown on the card. Up to 300 characters." />
        <MarkdownField name="details" label="Program details" initial={p?.details ?? ""} hint="Shown on the program's details page." />
        <TextArea label="Target audience" name="audience" rows={2} defaultValue={p?.audience ?? ""} maxLength={300} placeholder="Founders and operators building in MENA who…" />
        <OutlineEditor name="outline" initial={p?.outline ?? []} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label="Pre-requisites (one per line)" name="prerequisites" rows={4} defaultValue={p?.prerequisites.join("\n") ?? ""} />
          <TextArea label="Activities (one per line)" name="activities" rows={4} defaultValue={p?.activities.join("\n") ?? ""} />
        </div>
        <PeopleEditor name="hosts" label="Hosts" addLabel="Add host" initial={p?.hosts ?? []} />
        <PeopleEditor name="guests" label="Guests" addLabel="Add guest" initial={p?.guests ?? []} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Length (weeks)" name="weeks" defaultValue={p?.weeks ?? "[N]"} maxLength={20} />
          <TextField label="Order" name="sort" type="number" min={0} max={1000} defaultValue={p?.sort ?? 100} />
        </div>
        <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-soft-fg">Dates, format, location, Meet link, capacity and price per seat are set on each cohort (TVS › Cohorts), so the same program can run several times.</p>
        <label className="flex min-h-10 items-center gap-2 text-[13px] font-bold">
          <input type="checkbox" name="requires_tvac" defaultChecked={p?.requires_tvac ?? true} className="h-[18px] w-[18px] accent-primary" />
          Requires TVAC first
        </label>
        <TextField label="Tags (comma separated)" name="tags" defaultValue={p?.tags.join(", ") ?? ""} placeholder="Founders, Cohort" />
        <BrochureField name="brochure_url" initial={p?.brochure_url ?? null} />
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
