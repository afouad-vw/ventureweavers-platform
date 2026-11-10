"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileText, ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatHours, MAX_PEOPLE, MAX_SESSIONS, totalHours, type Person, type Session } from "@/lib/details";
import { uploadFile } from "@/lib/upload-client";
import { Markdown } from "@/components/content/markdown";

const input =
  "h-10 min-w-0 rounded-lg border border-line2 bg-card/80 px-2.5 text-[13.5px] text-fg placeholder:text-faint focus:border-primary focus:bg-card focus:outline-none desk:h-9";
const labelCls = "text-[12.5px] font-bold text-muted";

function move<T>(list: T[], i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Hosts or guests: name and short title, add, remove and reorder. Saved as JSON in a hidden field. */
export function PeopleEditor({ name, label, initial, addLabel }: { name: string; label: string; initial: Person[]; addLabel: string }) {
  const [rows, setRows] = useState<Person[]>(initial.length ? initial : []);
  const set = (i: number, k: keyof Person, v: string) => setRows((r) => r.map((p, n) => (n === i ? { ...p, [k]: v } : p)));
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`${labelCls} pb-1.5`}>{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((p, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input aria-label={`${label} ${i + 1} name`} value={p.name} onChange={(e) => set(i, "name", e.target.value)} maxLength={80} placeholder="Name" className={`${input} flex-1 basis-[150px]`} />
          <input aria-label={`${label} ${i + 1} title`} value={p.title} onChange={(e) => set(i, "title", e.target.value)} maxLength={120} placeholder="Title, e.g. Co-founder, VentureWeavers" className={`${input} flex-[2] basis-[200px]`} />
          <RowButtons onUp={() => setRows((r) => move(r, i, -1))} onDown={() => setRows((r) => move(r, i, 1))} onRemove={() => setRows((r) => r.filter((_, n) => n !== i))} label={p.name || `${label} ${i + 1}`} />
        </div>
      ))}
      {rows.length < MAX_PEOPLE ? (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setRows((r) => [...r, { name: "", title: "" }])}>
          <Plus size={14} aria-hidden="true" />
          {addLabel}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** Program outline: sessions with a title and duration in hours. Shows the total. */
export function OutlineEditor({ name, initial }: { name: string; initial: Session[] }) {
  const [rows, setRows] = useState<{ title: string; hours: string }[]>(initial.map((s) => ({ title: s.title, hours: String(s.hours) })));
  const parsed = rows.map((r) => ({ title: r.title.trim(), hours: Number(r.hours.replace(",", ".")) || 0 })).filter((r) => r.title);
  const total = totalHours(parsed);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`${labelCls} pb-1.5`}>Program outline (sessions)</legend>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 text-right font-display text-[13px] text-faint">{i + 1}</span>
          <input aria-label={`Session ${i + 1} title`} value={s.title} onChange={(e) => setRows((r) => r.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)))} maxLength={120} placeholder="Session title" className={`${input} flex-1`} />
          <label className="flex shrink-0 items-center gap-1 text-[12.5px] text-faint">
            <input aria-label={`Session ${i + 1} hours`} value={s.hours} onChange={(e) => setRows((r) => r.map((x, n) => (n === i ? { ...x, hours: e.target.value } : x)))} inputMode="decimal" placeholder="2" className={`${input} w-16 text-right`} />
            hrs
          </label>
          <RowButtons onUp={() => setRows((r) => move(r, i, -1))} onDown={() => setRows((r) => move(r, i, 1))} onRemove={() => setRows((r) => r.filter((_, n) => n !== i))} label={s.title || `Session ${i + 1}`} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {rows.length < MAX_SESSIONS ? (
          <Button size="sm" variant="secondary" onClick={() => setRows((r) => [...r, { title: "", hours: "2" }])}>
            <Plus size={14} aria-hidden="true" />
            Add session
          </Button>
        ) : null}
        {parsed.length ? <span className="text-[12.5px] text-faint">{parsed.length} {parsed.length === 1 ? "session" : "sessions"} · {formatHours(total)} in total</span> : null}
      </div>
    </fieldset>
  );
}

function RowButtons({ onUp, onDown, onRemove, label }: { onUp: () => void; onDown: () => void; onRemove: () => void; label: string }) {
  const b = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-fg";
  return (
    <span className="flex shrink-0">
      <button type="button" className={b} onClick={onUp} aria-label={`Move ${label} up`}><ArrowUp size={14} aria-hidden="true" /></button>
      <button type="button" className={b} onClick={onDown} aria-label={`Move ${label} down`}><ArrowDown size={14} aria-hidden="true" /></button>
      <button type="button" className={b} onClick={onRemove} aria-label={`Remove ${label}`}><Trash2 size={14} aria-hidden="true" /></button>
    </span>
  );
}

/** A text field with a "TBA" switch (location or Meet link not decided yet). Empty value = TBA. */
export function TbaField({ name, label, initial, placeholder, type = "text", hint }: { name: string; label: string; initial: string | null; placeholder: string; type?: string; hint?: string }) {
  const [tba, setTba] = useState(!initial);
  const [value, setValue] = useState(initial ?? "");
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      <input type="hidden" name={name} value={tba ? "" : value} />
      <div className="flex items-center gap-2">
        <input aria-label={label} type={type} value={tba ? "" : value} disabled={tba} onChange={(e) => setValue(e.target.value)} placeholder={tba ? "TBA" : placeholder} maxLength={300} className={`${input} flex-1 disabled:opacity-60`} />
        <label className="flex min-h-10 shrink-0 items-center gap-1.5 text-[13px] font-bold">
          <input type="checkbox" checked={tba} onChange={(e) => setTba(e.target.checked)} className="h-4 w-4 accent-primary" />
          TBA
        </label>
      </div>
      {hint ? <span className="text-[12px] text-faint">{hint}</span> : null}
    </div>
  );
}

/** Brochure: one PDF up to 10 MB, public download. */
export function BrochureField({ name, initial }: { name: string; initial: string | null }) {
  const [url, setUrl] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls}>Brochure</span>
      <input type="hidden" name={name} value={url ?? ""} />
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 self-start rounded-lg border border-line2 bg-card/70 px-3 py-2 text-[13px] font-bold hover:bg-card">
          <FileText size={16} className="text-primary" aria-hidden="true" />
          Brochure (PDF)
        </a>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => ref.current?.click()}>
          <FileText size={14} aria-hidden="true" />
          {pending ? "Uploading…" : url ? "Replace PDF" : "Upload PDF"}
        </Button>
        {url ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => setUrl(null)}><Trash2 size={14} aria-hidden="true" />Remove</Button> : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setError(null);
          start(async () => {
            const r = await uploadFile("brochures", f);
            if (r.ok && r.file.url) setUrl(r.file.url);
            else setError(r.ok ? "The upload didn't go through." : r.error);
            if (ref.current) ref.current.value = "";
          });
        }}
      />
      <span className="text-[12px] text-faint">PDF, up to 10 MB. Anyone can download it from the details page.</span>
      {error ? <span role="alert" className="text-[12.5px] font-bold text-bad-fg">{error}</span> : null}
    </div>
  );
}

/** Show photo gallery: up to 12 images, reorder and delete. */
export function GalleryField({ name, initial }: { name: string; initial: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const left = 12 - urls.length;
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls}>Photo gallery</span>
      <input type="hidden" name={name} value={JSON.stringify(urls)} />
      {urls.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((u, i) => (
            <div key={u} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-hover">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of uploaded photos */}
              <img src={u} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <span className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                <button type="button" aria-label={`Move photo ${i + 1} left`} onClick={() => setUrls((r) => move(r, i, -1))} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/70 text-white"><ArrowLeft size={13} aria-hidden="true" /></button>
                <button type="button" aria-label={`Delete photo ${i + 1}`} onClick={() => setUrls((r) => r.filter((x) => x !== u))} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/70 text-white"><Trash2 size={13} aria-hidden="true" /></button>
                <button type="button" aria-label={`Move photo ${i + 1} right`} onClick={() => setUrls((r) => move(r, i, 1))} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/70 text-white"><ArrowRight size={13} aria-hidden="true" /></button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {left > 0 ? (
        <Button size="sm" variant="secondary" className="self-start" disabled={pending} onClick={() => ref.current?.click()}>
          <ImagePlus size={14} aria-hidden="true" />
          {pending ? "Uploading…" : "Add photos"}
        </Button>
      ) : null}
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, left);
          if (!files.length) return;
          setError(null);
          start(async () => {
            const failed: string[] = [];
            for (const f of files) {
              const r = await uploadFile("event-gallery", f);
              if (r.ok && r.file.url) setUrls((x) => (x.length < 12 ? [...x, r.file.url!] : x));
              else failed.push(`${f.name}: ${r.ok ? "didn't go through" : r.error}`);
            }
            if (failed.length) setError(failed.join(" · "));
            if (ref.current) ref.current.value = "";
          });
        }}
      />
      <span className="text-[12px] text-faint">Up to 12 photos, JPG, PNG or WebP, 5 MB each. {urls.length ? `${left} left.` : "Shown on the show page when there are photos."}</span>
      {error ? <span role="alert" className="text-[12.5px] font-bold text-bad-fg">{error}</span> : null}
    </div>
  );
}

/** Longer text in Markdown with a Write / Preview switch (same Markdown as the blog). */
export function MarkdownField({ name, label, initial, hint, rows = 8 }: { name: string; label: string; initial: string; hint?: string; rows?: number }) {
  const [text, setText] = useState(initial);
  const [preview, setPreview] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={labelCls}>{label}</span>
        <span className="flex rounded-lg border border-line2 p-0.5 text-[12px] font-bold" role="group" aria-label={`${label} view`}>
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)} className={`rounded-md px-2 py-1 ${!preview ? "bg-primary text-white" : "text-faint"}`}>Write</button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(true)} className={`rounded-md px-2 py-1 ${preview ? "bg-primary text-white" : "text-faint"}`}>Preview</button>
        </span>
      </div>
      <input type="hidden" name={name} value={text} />
      {preview ? (
        <div className="min-h-[160px] rounded-lg border border-line bg-bg/60 p-3">
          {text.trim() ? <Markdown source={text} className="flex flex-col gap-2.5 text-[14px] leading-[1.6]" /> : <span className="text-[13px] text-faint">Nothing to preview yet.</span>}
        </div>
      ) : (
        <textarea aria-label={label} value={text} onChange={(e) => setText(e.target.value)} rows={rows} maxLength={20000} className="w-full resize-y rounded-lg border border-line2 bg-card/80 px-2.5 py-2 text-[13.5px] leading-snug text-fg placeholder:text-faint focus:border-primary focus:bg-card focus:outline-none" placeholder="## What you'll learn&#10;Write in plain paragraphs. **Bold**, lists with - and links work." />
      )}
      {hint ? <span className="text-[12px] text-faint">{hint}</span> : null}
    </div>
  );
}
