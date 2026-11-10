"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Download, Mail, MessageCircle, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import type { Contact, Space } from "@/lib/contacts/queries";
import { initialsOf } from "@/lib/initials";
import { deleteContact, exportContactsCsv, importContacts, saveContact, saveNote } from "./actions";

const SPACES: Space[] = ["Outloud", "TVS", "BRICKR", "QuidQuo"];
const CONSENT = ["Email, WhatsApp, push", "Email, WhatsApp", "Email", "WhatsApp", "Not asked yet"];
const waNumber = (p: string | null) => (p ? p.replace(/[^\d]/g, "").replace(/^0(?=1)/, "20") : "");

export function ContactsBoard({ contacts, initialQuery = "" }: { contacts: Contact[]; initialQuery?: string }) {
  const [seg, setSeg] = useState<"All" | Space>("All");
  const [q, setQ] = useState(initialQuery);
  const [selKey, setSelKey] = useState<string | null>(contacts[0]?.key ?? null);
  const [edit, setEdit] = useState<Contact | "new" | null>(null);
  const [del, setDel] = useState<Contact | null>(null);
  const [importing, setImporting] = useState(false);
  const r = useRunner();
  const toast = useToast();
  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () => contacts.filter((c) => (seg === "All" || c.spaces.includes(seg)) && (!needle || `${c.name} ${c.company ?? ""} ${c.role ?? ""} ${c.email ?? ""} ${c.spaces.join(" ")}`.toLowerCase().includes(needle))),
    [contacts, seg, needle],
  );
  const sel = contacts.find((c) => c.key === selKey) ?? rows[0] ?? null;
  const e = edit && edit !== "new" ? edit : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Spaces" className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-line">
          {(["All", ...SPACES] as const).map((s) => {
            const n = s === "All" ? contacts.length : contacts.filter((c) => c.spaces.includes(s)).length;
            return (
              <button key={s} type="button" aria-current={seg === s ? "page" : undefined} onClick={() => setSeg(s)} className={cn("-mb-px h-10 cursor-pointer border-b-2 px-3 text-[13.5px] font-bold whitespace-nowrap", seg === s ? "border-primary text-fg" : "border-transparent text-faint hover:text-fg")}>
                {s}<span className="ml-1 rounded-lg bg-hover px-1.5 py-px text-[11px] text-faint">{n}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await exportContactsCsv(seg, q);
              if (!res.ok) return toast(res.error);
              const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
              Object.assign(document.createElement("a"), { href: url, download: `contacts-${new Date().toISOString().slice(0, 10)}.csv` }).click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} aria-hidden="true" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <Upload size={15} aria-hidden="true" />
            Import CSV
          </Button>
          <Button onClick={() => { r.setError(null); setEdit("new"); }}>
            <Plus size={15} aria-hidden="true" />
            Add contact
          </Button>
        </div>
      </div>

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="relative flex w-full max-w-[340px] items-center">
            <Search size={16} className="pointer-events-none absolute left-2.5 text-faint" aria-hidden="true" />
            <span className="sr-only">Filter contacts</span>
            <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Filter by name, role, email or tag" className="h-10 w-full rounded-lg border border-line2 bg-card pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9" />
          </label>
          <TableBox minWidth={760} head={["Name", "Role · stage", "Spaces", "Source", "Last activity"]} empty={!rows.length && "No contacts match."}>
            {rows.map((c) => (
              <tr
                key={c.key}
                tabIndex={0}
                aria-selected={sel?.key === c.key}
                onClick={() => setSelKey(c.key)}
                onKeyDown={(ev) => ev.key === "Enter" && setSelKey(c.key)}
                className={cn("cursor-pointer border-b border-line last:border-b-0 hover:bg-hover", sel?.key === c.key && "bg-soft")}
              >
                <td className={td}><b className="block">{c.name}</b>{c.company ? <span className="text-faint">{c.company}</span> : null}</td>
                <td className={`${td} text-muted`}>{c.role ?? "—"}</td>
                <td className={td}><span className="flex flex-wrap gap-1">{c.spaces.length ? c.spaces.map((s) => <ThreadTag key={s} thread={s} />) : <span className="text-faint">—</span>}</span></td>
                <td className={`${td} text-muted`}>{c.source}</td>
                <td className={`${td} text-muted`}>{c.last ? <>{c.last.text}<span className="block text-[12px] text-faint">{relativeWhen(c.last.at)}</span></> : "—"}</td>
              </tr>
            ))}
          </TableBox>
        </div>
        <aside className="min-w-0">{sel ? <Panel key={sel.key} c={sel} onEdit={() => { r.setError(null); setEdit(sel); }} onDelete={() => setDel(sel)} /> : null}</aside>
      </div>

      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Contacts" title={e ? "Edit contact" : "Add contact"} pending={r.pending} error={r.error} formKey={e?.key ?? "new"} onSubmit={(fd) => r.run(() => saveContact(fd), () => setEdit(null))}>
        {e?.contactId ? <input type="hidden" name="id" value={e.contactId} /> : null}
        <TextField label="Full name" name="name" defaultValue={e?.name ?? ""} required maxLength={120} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Email" name="email" type="email" defaultValue={e?.email ?? ""} maxLength={200} />
          <TextField label="Mobile" name="phone" type="tel" defaultValue={e?.phone ?? ""} maxLength={40} placeholder="+20 …" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Company" name="company" defaultValue={e?.company ?? ""} maxLength={120} />
          <TextField label="Role · stage" name="role" defaultValue={e?.role ?? ""} maxLength={80} />
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1 text-[12.5px] font-bold text-muted">Spaces</legend>
          <div className="flex flex-wrap gap-3">
            {SPACES.map((s) => (
              <label key={s} className="flex min-h-10 items-center gap-1.5 text-[13.5px]">
                <input type="checkbox" name="tags" value={s} defaultChecked={e?.adminTags.includes(s)} className="h-4 w-4 accent-primary" />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <SelectField label="Consent" name="consent" defaultValue={e?.consent ?? "Not asked yet"} options={CONSENT} hint="What they agreed to be contacted by." />
      </EditorDrawer>

      <ConfirmDelete name={del?.name} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="Their note is deleted too. This doesn't affect member accounts." onConfirm={() => del?.contactId && r.run(() => deleteContact(del.contactId!), () => setDel(null))} />

      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </>
  );
}

function Panel({ c, onEdit, onDelete }: { c: Contact; onEdit: () => void; onDelete: () => void }) {
  const [note, setNote] = useState(c.note);
  const [tags, setTags] = useState<Space[]>(c.adminTags);
  const r = useRunner();
  const canNote = Boolean(c.memberId || c.contactId);
  const wa = waNumber(c.phone);
  return (
    <Card className="gap-3">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[14px] font-bold text-white">{initialsOf(c.name)}</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">{c.name}</b>
          <span className="text-[12.5px] text-faint">{c.memberId ? "Member" : "Added contact"}{c.role ? ` · ${c.role}` : ""}</span>
        </span>
        {!c.memberId && c.contactId ? (
          <>
            <IconBtn label={`Edit ${c.name}`} onClick={onEdit}><Pencil size={15} aria-hidden="true" /></IconBtn>
            <IconBtn label={`Delete ${c.name}`} onClick={onDelete}><Trash2 size={15} aria-hidden="true" /></IconBtn>
          </>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
        <div><dt className="text-faint">Email</dt><dd className="truncate font-bold">{c.email ?? "—"}</dd></div>
        <div><dt className="text-faint">Mobile</dt><dd className="font-bold">{c.phone ?? "—"}</dd></div>
        <div><dt className="text-faint">Source</dt><dd className="font-bold">{c.source}</dd></div>
        <div><dt className="text-faint">Consent</dt><dd className="font-bold">{c.consent}</dd></div>
      </dl>
      {c.spaces.length ? <div className="flex flex-wrap gap-1">{c.spaces.map((s) => <ThreadTag key={s} thread={s} />)}</div> : null}
      {c.items.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">Activity</span>
          {c.items.slice(0, 8).map((i, n) => (
            <div key={n} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-semibold">{i.label}</span>
              <StatusPill tone={/won|enrolled|confirmed|joined/i.test(i.status) ? "ok" : /declined|cancelled|expired/i.test(i.status) ? "draft" : "blue"}>{i.status.charAt(0).toUpperCase() + i.status.slice(1)}</StatusPill>
            </div>
          ))}
        </div>
      ) : null}
      {canNote ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-muted">
            Private note
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={3} maxLength={4000} placeholder="Visible to partners only" className="resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] font-normal text-fg placeholder:text-faint focus:border-primary focus:outline-none" />
          </label>
          {c.memberId ? (
            <div className="flex flex-wrap gap-3">
              {SPACES.map((s) => (
                <label key={s} className="flex min-h-9 items-center gap-1.5 text-[13px]">
                  <input type="checkbox" checked={tags.includes(s)} onChange={(ev) => setTags(ev.target.checked ? [...tags, s] : tags.filter((t) => t !== s))} className="h-4 w-4 accent-primary" />
                  {s}
                </label>
              ))}
            </div>
          ) : null}
          <Button size="sm" className="self-start" disabled={r.pending} onClick={() => r.run(() => saveNote({ memberId: c.memberId, contactId: c.contactId }, note, c.memberId ? tags : c.adminTags))}>Save note</Button>
        </div>
      ) : (
        <span className="text-[12.5px] text-faint">Added from the QuidQuo waitlist. Add them as a contact to keep notes.</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-card px-3 text-[13px] font-bold hover:bg-hover">
            <MessageCircle size={14} aria-hidden="true" />
            WhatsApp
          </a>
        ) : null}
        {c.email ? (
          <a href={`mailto:${c.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-card px-3 text-[13px] font-bold hover:bg-hover">
            <Mail size={14} aria-hidden="true" />
            Email
          </a>
        ) : null}
      </div>
      {c.memberId ? <span className="text-[12px] text-faint">Members manage their own name, phone and profile in My space.</span> : null}
    </Card>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: { line: number; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Modal
      open={open}
      onClose={() => { onClose(); setResult(null); setText(""); setFile(""); setError(null); }}
      title="Import contacts"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            disabled={pending || !text}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await importContacts(text);
                if (r.ok) setResult({ added: r.added, skipped: r.skipped });
                else setError(r.error);
              })
            }
          >
            {pending ? "Importing…" : "Import"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[13.5px]">
        <p>A CSV with a header row. Columns we read: <b>name</b> (needed), <b>email</b>, <b>mobile</b>, <b>company</b>, <b>role</b> and <b>tags</b> (Outloud, TVS, BRICKR, QuidQuo). Up to 1,000 rows; people already in contacts (by email) are skipped.</p>
        <Button variant="secondary" size="sm" className="self-start" onClick={() => input.current?.click()}>
          <Upload size={14} aria-hidden="true" />
          {file || "Choose a CSV file"}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            if (!f) return;
            if (f.size > 2_000_000) return setError("The file is too large (2 MB at most).");
            setFile(f.name);
            setResult(null);
            setText(await f.text());
          }}
        />
        {result ? (
          <div className="rounded-lg bg-soft p-3">
            <b>{result.added} added</b>
            {result.skipped.length ? (
              <>
                <span>, {result.skipped.length} skipped:</span>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-[12.5px]">
                  {result.skipped.slice(0, 50).map((s) => <li key={s.line}>Line {s.line}: {s.reason}</li>)}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
        {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
      </div>
    </Modal>
  );
}
