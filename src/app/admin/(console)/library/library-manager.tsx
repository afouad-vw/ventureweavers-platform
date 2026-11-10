"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileUp, Lock, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { uploadFile } from "@/components/admin/upload";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import type { AdminResource } from "@/lib/content/admin-queries";
import { accessLabel, ACCESS_LEVELS, isSpace, LIBRARY_KINDS, OPEN_LEVELS, SPACES } from "@/lib/content/format";
import { deleteResource, duplicateResource, previewResource, saveResource, setResourceStatus } from "../content-actions";

const mb = (n: number | null) => (n ? `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB` : "");

/** Admin › Library: resources with type, space, who can open them, and a file or link. */
export function LibraryManager({ items }: { items: AdminResource[] }) {
  const [editing, setEditing] = useState<AdminResource | "new" | null>(null);
  const [del, setDel] = useState<AdminResource | null>(null);
  const { pending, error, setError, run } = useRunner();
  const [, startOpen] = useTransition();
  const toast = useToast();
  const r = editing && editing !== "new" ? editing : null;

  const open = (id: string) => {
    const tab = window.open("about:blank", "_blank");
    startOpen(async () => {
      const res = await previewResource(id);
      if (res.ok && tab) {
        tab.opener = null;
        tab.location.href = res.url;
      } else {
        tab?.close();
        if (!res.ok) toast(res.error);
      }
    });
  };

  return (
    <>
      <ListBar count={items.length} noun="resources" newLabel="New resource" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox minWidth={860} head={["Resource", "Type", "Space", "Access", "File or link", "Status", "Actions"]} empty={!items.length && "No resources yet. Add the first report or template."}>
        {items.map((it) => (
          <tr key={it.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{it.title}</b><span className="line-clamp-1 text-faint">{it.description}</span></td>
            <td className={td}>{it.kind}</td>
            <td className={td}><ThreadTag thread={isSpace(it.space) ? it.space : "House"} /></td>
            <td className={`${td} whitespace-nowrap text-muted`}>
              <span className="inline-flex items-center gap-1">{(OPEN_LEVELS as string[]).includes(it.access) ? null : <Lock size={12} aria-label="Locked for members until this level exists" />}{accessLabel(it.access)}</span>
            </td>
            <td className={`${td} text-muted`}>
              {it.file_path ? <span className="block max-w-[180px] truncate" title={it.file_name ?? ""}>{it.file_name} · {mb(it.file_size)}</span> : it.link_url ? <span className="block max-w-[180px] truncate" title={it.link_url}>{it.link_url.replace(/^https:\/\//, "")}</span> : <span className="text-faint">None yet</span>}
            </td>
            <td className={td}><StatusPill tone={it.status === "published" ? "ok" : "draft"}>{it.status === "published" ? "Published" : "Draft"}</StatusPill></td>
            <td className={td}>
              <RowActions
                name={it.title}
                published={it.status === "published"}
                onEdit={() => { setError(null); setEditing(it); }}
                onDuplicate={() => run(() => duplicateResource(it.id))}
                onToggle={() => run(() => setResourceStatus(it.id, it.status === "published" ? "draft" : "published"))}
                onDelete={() => setDel(it)}
                extra={it.ready ? <IconBtn label={`Open ${it.title}`} onClick={() => open(it.id)}><Download size={15} aria-hidden="true" /></IconBtn> : null}
              />
            </td>
          </tr>
        ))}
      </TableBox>
      <p className="text-[12.5px] text-faint">
        Members can open <b>All members</b> resources now. TVS learners, BRICKR clients and QuidQuo waitlist resources show as locked until those memberships exist.
      </p>

      <EditorDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="Library"
        title={r ? "Edit resource" : "New resource"}
        pending={pending}
        error={error}
        formKey={r?.id ?? "new"}
        onSubmit={(fd) => run(() => saveResource(fd), () => setEditing(null))}
      >
        {r ? <input type="hidden" name="id" value={r.id} /> : null}
        <TextField label="Title" name="title" defaultValue={r?.title ?? ""} required minLength={3} maxLength={160} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Type" name="kind" defaultValue={r?.kind ?? "Guide"} options={LIBRARY_KINDS} />
          <SelectField label="Space" name="space" defaultValue={r?.space ?? "House"} options={SPACES} />
        </div>
        <SelectField label="Who can open it" name="access" defaultValue={r?.access ?? "all_members"} options={ACCESS_LEVELS} />
        <TextArea label="Description" name="description" rows={3} defaultValue={r?.description ?? ""} maxLength={600} />
        <SourceField resource={r} />
        <SelectField label="Status" name="status" defaultValue={r?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
      </EditorDrawer>

      <ConfirmDelete
        name={del?.title}
        open={del !== null}
        onClose={() => setDel(null)}
        pending={pending}
        note="Its uploaded file is deleted too. To hide it instead, set it to Draft."
        onConfirm={() => del && run(() => deleteResource(del.id), () => setDel(null))}
      />
    </>
  );
}

function SourceField({ resource: r }: { resource: AdminResource | null }) {
  const [source, setSource] = useState<"file" | "link">(r?.link_url ? "link" : "file");
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(r?.file_path ? { path: r.file_path, name: r.file_name ?? "file", size: r.file_size ?? 0 } : null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <legend className="px-1 text-[12.5px] font-bold text-muted">File or link</legend>
      <input type="hidden" name="source" value={source} />
      <div className="flex gap-1.5" role="radiogroup" aria-label="Where it lives">
        {(["file", "link"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={source === v}
            onClick={() => setSource(v)}
            className={`h-9 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold desk:h-[30px] ${source === v ? "border-fg bg-fg text-bg" : "border-line2 bg-card text-fg hover:bg-hover"}`}
          >
            {v === "file" ? "Upload a file" : "Link"}
          </button>
        ))}
      </div>
      {source === "file" ? (
        <>
          <input type="hidden" name="file_path" value={file?.path ?? ""} />
          <input type="hidden" name="file_name" value={file?.name ?? ""} />
          <input type="hidden" name="file_size" value={file?.size ?? ""} />
          {file ? (
            <div className="flex items-center gap-2 rounded-lg bg-hover px-2.5 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-bold">{file.name}</span>
              <span className="text-faint">{mb(file.size)}</span>
              <IconBtn label="Remove file" onClick={() => setFile(null)}><Trash2 size={14} aria-hidden="true" /></IconBtn>
            </div>
          ) : null}
          <Button variant="secondary" size="sm" className="self-start" disabled={pending} onClick={() => input.current?.click()}>
            <FileUp size={14} aria-hidden="true" />
            {pending ? "Uploading…" : file ? "Replace file" : "Choose file"}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setNote(null);
              start(async () => {
                const res = await uploadFile("library-files", f);
                if (res.ok) setFile({ path: res.file.path, name: res.file.fileName, size: res.file.size });
                else setNote(res.error);
                if (input.current) input.current.value = "";
              });
            }}
          />
          <span className="text-[12px] text-faint">PDF, Word, Excel, PowerPoint or ZIP, up to 20 MB. Files are private: members get a download link that expires after 5 minutes.</span>
          {note ? <span role="alert" className="text-[12.5px] font-bold text-bad-fg">{note}</span> : null}
        </>
      ) : (
        <TextField label="Link" name="link_url" type="url" defaultValue={r?.link_url ?? ""} placeholder="https://…" hint="For AI skills, shared folders or anything hosted elsewhere. Shown only to members whose level allows it." />
      )}
    </fieldset>
  );
}
