"use client";

import { useState } from "react";
import { ConfirmDelete, EditorDrawer, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { ImageField } from "@/components/admin/image-field";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import type { Service } from "@/lib/brickr/queries";
import { deleteService, duplicateService, saveService, setServiceStatus } from "./actions";

export function ServicesManager({ services }: { services: Service[] }) {
  const [edit, setEdit] = useState<Service | "new" | null>(null);
  const [del, setDel] = useState<Service | null>(null);
  const r = useRunner();
  const s = edit && edit !== "new" ? edit : null;
  return (
    <>
      <ListBar count={services.length} noun="services" newLabel="New service" onNew={() => { r.setError(null); setEdit("new"); }} />
      <TableBox minWidth={760} head={["Service", "Space", "For", "Format", "Status", "Actions"]} empty={!services.length && "No services yet."}>
        {services.map((x) => (
          <tr key={x.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{x.name}</b><span className="line-clamp-1 text-faint">{x.description}</span></td>
            <td className={td}><ThreadTag thread={x.space} /></td>
            <td className={`${td} text-muted`}>{x.audience}</td>
            <td className={`${td} text-muted`}>{x.format}</td>
            <td className={td}><StatusPill tone={x.status === "published" ? "ok" : "draft"}>{x.status === "published" ? "Published" : "Draft"}</StatusPill></td>
            <td className={td}>
              <RowActions
                name={x.name}
                published={x.status === "published"}
                onEdit={() => { r.setError(null); setEdit(x); }}
                onDuplicate={() => r.run(() => duplicateService(x.id))}
                onToggle={() => r.run(() => setServiceStatus(x.id, x.status === "published" ? "draft" : "published"))}
                onDelete={() => setDel(x)}
              />
            </td>
          </tr>
        ))}
      </TableBox>
      <p className="text-[12.5px] text-faint">An Outloud service is what &ldquo;Request a session&rdquo; on Outloud books (the Open Floor private session).</p>
      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="BRICKR · Service" title={s ? "Edit service" : "New service"} pending={r.pending} error={r.error} formKey={s?.id ?? "new"} onSubmit={(fd) => r.run(() => saveService(fd), () => setEdit(null))}>
        {s ? <input type="hidden" name="id" value={s.id} /> : null}
        <TextField label="Name" name="name" defaultValue={s?.name ?? ""} required maxLength={100} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Space" name="space" defaultValue={s?.space ?? "BRICKR"} options={["BRICKR", "Outloud"]} />
          <SelectField label="Status" name="status" defaultValue={s?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="For" name="audience" defaultValue={s?.audience ?? "Founders"} maxLength={60} />
          <TextField label="Format" name="format" defaultValue={s?.format ?? ""} maxLength={80} placeholder="One session · written read-out" />
        </div>
        <TextArea label="Description" name="description" rows={3} defaultValue={s?.description ?? ""} maxLength={600} />
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <TextField label="Tags (comma separated)" name="tags" defaultValue={s?.tags.join(", ") ?? ""} />
          <TextField label="Order" name="sort" type="number" min={0} max={1000} defaultValue={s?.sort ?? 100} />
        </div>
        <ImageField name="banner_url" initial={s?.banner_url ?? null} />
        <SelectField label="Photo or pattern (used when no image is uploaded)" name="banner" defaultValue={s?.banner ?? "Round"} options={BANNER_OPTIONS} />
      </EditorDrawer>
      <ConfirmDelete name={del?.name} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="Services with requests can't be deleted; set them to Draft instead." onConfirm={() => del && r.run(() => deleteService(del.id), () => setDel(null))} />
    </>
  );
}
