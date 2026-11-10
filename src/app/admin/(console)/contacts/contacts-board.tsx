"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Download, Mail, MessageCircle, Plus, Search, Upload } from "lucide-react";
import { TableBox, td } from "@/components/admin/crud";
import { Button, buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { ThreadTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import type { Contact, Space } from "@/lib/contacts/queries";
import { initialsOf } from "@/lib/initials";
import { exportContactsCsv, importContacts } from "./actions";
import { ContactEditor } from "./contact-editor";
import { waNumber } from "./wa";

const SPACES: Space[] = ["Outloud", "TVS", "BRICKR", "QuidQuo"];

export function ContactsBoard({ contacts, base, canManage = true, initialQuery = "" }: { contacts: Contact[]; base: string; canManage?: boolean; initialQuery?: string }) {
  const [seg, setSeg] = useState<"All" | Space>("All");
  const [q, setQ] = useState(initialQuery);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () => contacts.filter((c) => (seg === "All" || c.spaces.includes(seg)) && (!needle || `${c.name} ${c.company ?? ""} ${c.role ?? ""} ${c.email ?? ""} ${c.spaces.join(" ")}`.toLowerCase().includes(needle))),
    [contacts, seg, needle],
  );
  const href = (c: Contact) => `${base}/contacts/${c.key.replace(":", "-")}`;

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
        {canManage ? <div className="flex flex-wrap gap-2">
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
          <Button onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden="true" />
            Add contact
          </Button>
        </div> : null}
      </div>

      <label className="relative flex w-full max-w-[340px] items-center">
        <Search size={16} className="pointer-events-none absolute left-2.5 text-faint" aria-hidden="true" />
        <span className="sr-only">Filter contacts</span>
        <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Filter by name, role, email or tag" className="h-10 w-full rounded-lg border border-line2 bg-card pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9" />
      </label>
      <TableBox minWidth={900} head={["Name", "Role · stage", "Spaces", "Source", "Last activity", ""]} empty={!rows.length && "No contacts match."}>
        {rows.map((c) => {
          const wa = waNumber(c.phone);
          return (
            <tr key={c.key} className="border-b border-line last:border-b-0 hover:bg-hover">
              <td className={td}>
                <Link href={href(c)} className="flex items-center gap-2.5 hover:[&_b]:underline">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[12px] font-bold text-white">{initialsOf(c.name)}</span>
                  <span className="min-w-0"><b className="block">{c.name}</b><span className="text-[12px] text-faint">{c.email ?? c.company ?? (c.memberId ? "Member" : "Added contact")}</span></span>
                </Link>
              </td>
              <td className={`${td} text-muted`}>{c.role ?? "—"}</td>
              <td className={td}><span className="flex flex-wrap gap-1">{c.spaces.length ? c.spaces.map((s) => <ThreadTag key={s} thread={s} />) : <span className="text-faint">—</span>}</span></td>
              <td className={`${td} text-muted`}>{c.source}</td>
              <td className={`${td} text-muted`}>{c.last ? <>{c.last.text}<span className="block text-[12px] text-faint">{relativeWhen(c.last.at)}</span></> : "—"}</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <span className="inline-flex items-center gap-1">
                  {c.email ? <a href={`mailto:${c.email}`} title={`Email ${c.name}`} aria-label={`Email ${c.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-card"><Mail size={15} aria-hidden="true" /></a> : null}
                  {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${c.name}`} aria-label={`WhatsApp ${c.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-card"><MessageCircle size={15} aria-hidden="true" /></a> : null}
                  <Link href={href(c)} className={buttonClass("secondary", "sm")}>View details</Link>
                </span>
              </td>
            </tr>
          );
        })}
      </TableBox>

      <ContactEditor open={adding} contact={null} onClose={() => setAdding(false)} onSaved={() => router.refresh()} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </>
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
