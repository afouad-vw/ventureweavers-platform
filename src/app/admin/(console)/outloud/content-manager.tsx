"use client";

import { useState } from "react";
import { ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { ImageField } from "@/components/admin/image-field";
import { ConfirmDelete, EditorDrawer, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { CONTENT_FORMATS, CONTENT_STATUSES, PLATFORMS, relativeWhen } from "@/lib/content/format";
import type { InstagramTokenStatus, SeriesWithCount, SyncStatus } from "@/lib/content/admin-queries";
import type { ContentItem } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";
import { deleteContent, deleteSeries, duplicateContent, saveContent, saveSeries, setContentStatus, syncShortsNow, connectInstagram, disconnectInstagram } from "../content-actions";

const today = () => new Date().toISOString().slice(0, 10);
const tone = (s: string) => (s === "published" ? "ok" : s === "scheduled" ? "blue" : "draft") as "ok" | "blue" | "draft";
const label = (s: string) => CONTENT_STATUSES.find((x) => x.value === s)?.label ?? s;

const SOURCE_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };

/** Admin › Outloud › Digital content: Shorts (pulled from @ventureweavers or added by hand), episodes and their series. */
export function ContentManager({ items, series, sync, isSuper = false }: { items: ContentItem[]; series: SeriesWithCount[]; sync: { connected: string[]; runs: SyncStatus[]; instagram?: InstagramTokenStatus }; isSuper?: boolean }) {
  const [igOpen, setIgOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [del, setDel] = useState<ContentItem | null>(null);
  const [editSeries, setEditSeries] = useState<SeriesWithCount | "new" | null>(null);
  const [delSeries, setDelSeries] = useState<SeriesWithCount | null>(null);
  const { pending, error, setError, run } = useRunner();
  const c = editing && editing !== "new" ? editing : null;
  const sr = editSeries && editSeries !== "new" ? editSeries : null;
  const seriesNames = series.map((x) => x.name);

  return (
    <>
      <Card>
        <CardHeader
          title="Pulled from your accounts"
          action={
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => syncShortsNow())}>
              <RefreshCw size={14} aria-hidden="true" />
              Sync now
            </Button>
          }
        />
        <p className="text-[13px] text-muted">
          Episodes come from the YouTube channel (each playlist is a show) and Shorts from Instagram reels, automatically every hour while members visit Outloud, and daily. Members see the 10 latest Shorts. Add TikTok reels by link; their preview is found for you. Set a pulled item to Draft to hide it; it stays hidden.
        </p>
        <ul className="flex flex-col gap-1 text-[13px]">
          {["youtube", "instagram"].map((src) => {
            const on = sync.connected.includes(src);
            const r = sync.runs.find((x) => x.source === src);
            return (
              <li key={src} className="flex flex-wrap items-center gap-2">
                <b className="w-[150px]">{src === "youtube" ? "YouTube · Episodes" : "Instagram · Shorts"}</b>
                {!on ? (
                  <span className="text-faint">Not connected{src === "youtube" ? " (YOUTUBE_API_KEY in Vercel)" : ""}</span>
                ) : r?.last_error ? (
                  <StatusPill tone="bad">Last sync failed: {r.last_error}</StatusPill>
                ) : r?.last_ok_at ? (
                  <span className="text-muted">Synced {relativeWhen(r.last_ok_at)}{r.last_count ? ` · ${r.last_count} new` : ""}</span>
                ) : (
                  <span className="text-faint">Connected, not synced yet</span>
                )}
              </li>
            );
          })}
          {isSuper ? (
            <li className="flex flex-col gap-2 rounded-lg bg-paper/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">
                  Instagram token:{" "}
                  {sync.instagram?.connected
                    ? sync.instagram.fromEnv
                      ? "from Vercel (not renewed automatically). Paste it here to have it renewed."
                      : `saved, renewed weekly${sync.instagram.expiresAt ? ` · valid until ${formatDate(sync.instagram.expiresAt)}` : ""}${sync.instagram.lastError ? ` · ${sync.instagram.lastError}` : ""}`
                    : "not connected"}
                </span>
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => { setError(null); setIgOpen((v) => !v); }}>
                  {sync.instagram?.connected ? "Replace token" : "Connect Instagram"}
                </Button>
                {sync.instagram?.connected && !sync.instagram.fromEnv ? (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => disconnectInstagram())}>Disconnect</Button>
                ) : null}
              </div>
              {igOpen ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => connectInstagram(fd), () => setIgOpen(false)); }}
                >
                  <div className="min-w-[260px] flex-1">
                    <TextField label="Long-lived access token (Instagram API with Instagram Login)" name="token" type="password" autoComplete="off" required minLength={20} maxLength={1000} hint="Checked with Instagram, stored server-side only and renewed automatically. Super admins only." />
                  </div>
                  <Button type="submit" size="sm" disabled={pending}>Connect and sync</Button>
                </form>
              ) : null}
              {igOpen && error ? <p className="text-[13px] text-bad-fg">{error}</p> : null}
            </li>
          ) : null}
          <li className="flex flex-wrap items-center gap-2"><b className="w-[150px]">TikTok · Shorts</b><span className="text-faint">Add reels by link (New content); the preview is found for you</span></li>
        </ul>
      </Card>

      <ListBar count={items.length} noun="items" newLabel="New content" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox head={["Content", "Platform", "Date", "Status", "Actions"]} empty={!items.length && "No content yet. Add the first short or carousel."}>
        {items.map((it) => (
          <tr key={it.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{it.title}</b><span className="text-faint">{it.format === "Episode" ? `${it.series} · Episode` : it.format}{it.source !== "manual" ? ` · pulled from ${SOURCE_LABEL[it.source] ?? it.source}` : ""}</span></td>
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
          <SelectField label="Series" name="series" defaultValue={c?.series ?? seriesNames[0]} options={seriesNames} hint="Episodes are grouped by series." />
          <SelectField label="Format" name="format" defaultValue={c?.format ?? "Short"} options={CONTENT_FORMATS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Platform" name="platform" defaultValue={c?.platform ?? "Instagram"} options={PLATFORMS} />
          <TextField label="Publish date" name="publish_on" type="date" defaultValue={c?.publish_on ?? today()} required />
        </div>
        <TextField label="Link" name="url" type="url" defaultValue={c?.url ?? ""} placeholder="https://www.instagram.com/…" hint="Needed to publish. Scheduled items show as “Coming [date]” without a link." />
        <ImageField
          name="image_url"
          initial={c?.image_url ?? null}
          label="Preview image"
          fallbackNote="A clear frame from the content works best. For YouTube links, the video's own high-resolution thumbnail is used when you don't upload one."
        />
        <SelectField label="Status" name="status" defaultValue={c?.status ?? "draft"} options={CONTENT_STATUSES} />
      </EditorDrawer>

      <ConfirmDelete
        name={del?.title}
        open={del !== null}
        onClose={() => setDel(null)}
        pending={pending}
        note={del && del.source !== "manual" ? "This was pulled from your account and will come back at the next sync. Set it to Draft instead to hide it for good." : undefined}
        onConfirm={() => del && run(() => deleteContent(del.id), () => setDel(null))}
      />

      <Card>
        <CardHeader
          title="Series"
          action={<Button variant="secondary" size="sm" onClick={() => { setError(null); setEditSeries("new"); }}>New series</Button>}
        />
        <p className="text-[13px] text-muted">Each show or series is a collapsible group of episodes in the member app, for example Open Floor with its episodes.</p>
        <ul className="flex flex-col">
          {series.map((x) => (
            <li key={x.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-[13.5px]">{x.name}</b>
                {x.description ? <span className="truncate text-[12.5px] text-faint">{x.description}</span> : null}
              </span>
              <span className="shrink-0 text-[12.5px] text-faint">{x.count} item{x.count === 1 ? "" : "s"}</span>
              <button type="button" onClick={() => { setError(null); setEditSeries(x); }} aria-label={`Edit ${x.name}`} title="Edit" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-hover desk:h-8 desk:w-8"><Pencil size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => setDelSeries(x)} aria-label={`Delete ${x.name}`} title="Delete" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-hover desk:h-8 desk:w-8"><Trash2 size={15} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      </Card>

      <EditorDrawer
        open={editSeries !== null}
        onClose={() => setEditSeries(null)}
        eyebrow="Outloud · Series"
        title={sr ? "Edit series" : "New series"}
        pending={pending}
        error={error}
        formKey={sr?.id ?? "new-series"}
        onSubmit={(fd) => run(() => saveSeries(fd), () => setEditSeries(null))}
      >
        {sr ? <input type="hidden" name="id" value={sr.id} /> : null}
        <TextField label="Name" name="name" defaultValue={sr?.name ?? ""} required maxLength={60} placeholder="Open Floor" hint={sr?.count ? "Renaming moves its items with it." : undefined} />
        <TextArea label="Short description (optional)" name="description" defaultValue={sr?.description ?? ""} maxLength={300} rows={3} />
      </EditorDrawer>

      <ConfirmDelete
        name={delSeries?.name}
        open={delSeries !== null}
        onClose={() => setDelSeries(null)}
        pending={pending}
        note={delSeries?.count ? "Move or delete its items first." : undefined}
        onConfirm={() => delSeries && run(() => deleteSeries(delSeries.id), () => setDelSeries(null))}
      />
    </>
  );
}
