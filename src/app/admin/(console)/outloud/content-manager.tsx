"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { ConfirmDelete, EditorDrawer, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { SelectField, TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { CONTENT_FORMATS, CONTENT_STATUSES, PLATFORMS, SERIES } from "@/lib/content/format";
import type { ContentItem } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";
import { deleteContent, duplicateContent, saveContent, setContentStatus } from "../content-actions";

const today = () => new Date().toISOString().slice(0, 10);
const tone = (s: string) => (s === "published" ? "ok" : s === "scheduled" ? "blue" : "draft") as "ok" | "blue" | "draft";
const label = (s: string) => CONTENT_STATUSES.find((x) => x.value === s)?.label ?? s;

/** Admin › Outloud › Digital content: shorts, carousels, reels and episodes with their links. */
export function ContentManager({ items }: { items: ContentItem[] }) {
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [del, setDel] = useState<ContentItem | null>(null);
  const { pending, error, setError, run } = useRunner();
  const c = editing && editing !== "new" ? editing : null;

  return (
    <>
      <ListBar count={items.length} noun="items" newLabel="New content" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox head={["Content", "Platform", "Date", "Status", "Actions"]} empty={!items.length && "No content yet. Add the first short or carousel."}>
        {items.map((it) => (
          <tr key={it.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{it.title}</b><span className="text-faint">{it.series} · {it.format}</span></td>
            <td className={td}>{it.platform}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDate(it.publish_on + "T12:00:00Z")}</td>
            <td className={td}><StatusPill tone={tone(it.status)}>{label(it.status)}</StatusPill></td>
            <td className={td}>
              <RowActions
                name={it.title}
                published={it.status === "published"}
                onEdit={() => { setError(null); setEditing(it); }}
                onDuplicate={() => run(() => duplicateContent(it.id))}
                onToggle={() => run(() => setContentStatus(it.id, it.status === "published" ? "draft" : it.url ? "published" : "scheduled"))}
                onDelete={() => setDel(it)}
                extra={it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" title="Open link" aria-label={`Open ${it.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-hover"><ExternalLink size={15} aria-hidden="true" /></a> : null}
              />
            </td>
          </tr>
        ))}
      </TableBox>

      <EditorDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="Outloud · Digital content"
        title={c ? "Edit content" : "New content"}
        pending={pending}
        error={error}
        formKey={c?.id ?? "new"}
        onSubmit={(fd) => run(() => saveContent(fd), () => setEditing(null))}
      >
        {c ? <input type="hidden" name="id" value={c.id} /> : null}
        <TextField label="Title" name="title" defaultValue={c?.title ?? ""} required minLength={3} maxLength={160} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Series" name="series" defaultValue={c?.series ?? SERIES[0]} options={SERIES} />
          <SelectField label="Format" name="format" defaultValue={c?.format ?? "Short"} options={CONTENT_FORMATS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Platform" name="platform" defaultValue={c?.platform ?? "Instagram"} options={PLATFORMS} />
          <TextField label="Publish date" name="publish_on" type="date" defaultValue={c?.publish_on ?? today()} required />
        </div>
        <TextField label="Link" name="url" type="url" defaultValue={c?.url ?? ""} placeholder="https://www.instagram.com/…" hint="Needed to publish. Scheduled items show as “Coming [date]” without a link." />
        <SelectField label="Status" name="status" defaultValue={c?.status ?? "draft"} options={CONTENT_STATUSES} />
      </EditorDrawer>

      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={pending} onConfirm={() => del && run(() => deleteContent(del.id), () => setDel(null))} />
    </>
  );
}
