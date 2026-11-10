"use client";

import { useRef, useState } from "react";
import { Pencil, Send } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { ImageField } from "@/components/admin/image-field";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import type { PublishEntry } from "@/lib/content/admin-queries";
import { isSpace, relativeWhen, SPACES } from "@/lib/content/format";
import type { PostRow } from "@/lib/content/queries";
import { formatDateTime, isoToCairoLocal } from "@/lib/events/format";
import { deletePost, duplicatePost, publishUpdate, savePost, setPostStatus } from "../content-actions";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const cairoDate = (iso: string) => isoToCairoLocal(iso).slice(0, 10);

/** Fields shared by the composer and the post editor. */
function PostFields({ p }: { p?: PostRow | null }) {
  const [pin, setPin] = useState(Boolean(p?.pinned_until));
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Space" name="space" defaultValue={p?.space ?? "Outloud"} options={SPACES} />
        <TextField label="Kind" name="kind" defaultValue={p?.kind ?? "Update"} maxLength={80} placeholder="Update, Program, Service…" />
      </div>
      <TextField label="Headline" name="title" defaultValue={p?.title ?? ""} required minLength={3} maxLength={160} />
      <TextArea label="Message" name="body" rows={4} defaultValue={p?.body ?? ""} maxLength={2000} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Button label" name="link_label" defaultValue={p?.link_label ?? ""} maxLength={40} placeholder="Open" />
        <TextField label="Button link" name="link_url" defaultValue={p?.link_url ?? ""} maxLength={500} placeholder="/outloud or https://…" hint="A page in the app (starts with /) or an https:// address." />
      </div>
      <ImageField name="image_url" initial={p?.image_url ?? null} label="Image (optional)" fallbackNote="Without an image, the space's icon or the photo below is shown." />
      <SelectField label="Photo (optional)" name="banner" defaultValue={p?.banner ?? ""} options={[{ value: "", label: "None" }, ...BANNER_OPTIONS.filter((b) => b !== "Pattern").map((b) => ({ value: b, label: b }))]} />
      <label className="flex min-h-10 items-center gap-2 text-[13px] font-bold">
        <input type="checkbox" name="pin" checked={pin} onChange={(e) => setPin(e.target.checked)} className="h-[18px] w-[18px] accent-primary" />
        Pin as an announcement on members&apos; Home
      </label>
      {pin ? <TextField label="Pinned until (end of day, Cairo)" name="pinned_until" type="date" defaultValue={p?.pinned_until ? cairoDate(p.pinned_until) : inDays(7)} required /> : null}
    </>
  );
}

export function PublishingBoard({ posts, log, subscribers, emailReady }: { posts: PostRow[]; log: PublishEntry[]; subscribers: number; emailReady: boolean }) {
  const [editing, setEditing] = useState<PostRow | null>(null);
  const [del, setDel] = useState<PostRow | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [composeKey, setComposeKey] = useState(0);
  const [email, setEmail] = useState(false);
  const [when, setWhen] = useState("");
  const compose = useRunner();
  const edit = useRunner();
  const formRef = useRef<HTMLFormElement>(null);
  const now = Date.now();
  const announcements = posts.filter((p) => p.status === "published" && p.pinned_until && new Date(p.pinned_until).getTime() > now);

  const send = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    compose.run(() => publishUpdate(fd), () => {
      setComposeKey((k) => k + 1);
      setEmail(false);
      setWhen("");
    });
  };

  return (
    <>
      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
        <Card as="section">
          <CardHeader title="New update" />
          <form
            key={composeKey}
            ref={formRef}
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setConfirmEmail(true);
              else send();
            }}
          >
            <fieldset className="flex flex-col gap-1.5">
              <legend className="pb-1.5 text-[12.5px] font-bold text-muted">Channels</legend>
              <div className="flex flex-wrap gap-1.5">
                <Channel name="ch_feed" label="Home feed" defaultChecked />
                <Channel name="ch_email" label={`The Floor Notes · ${subscribers} subscriber${subscribers === 1 ? "" : "s"}`} checked={email} onChange={setEmail} disabled={!emailReady} />
                <Channel label="WhatsApp · later" disabled />
                <Channel label="Push · later" disabled />
              </div>
              {!emailReady ? <span className="text-[12px] text-faint">Email switches on once RESEND_API_KEY is added in Vercel.</span> : null}
            </fieldset>
            <SelectField label="Audience" name="audience" defaultValue="all" options={[{ value: "all", label: "All members (email: The Floor Notes subscribers)" }]} hint="Audiences by role, stage and space arrive with TVS, BRICKR and QuidQuo memberships." />
            <PostFields />
            <TextField
              label="Schedule for the feed (optional, Cairo time)"
              name="published_at"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              hint="Leave empty to publish now. Emails always go out right away."
            />
            {compose.error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{compose.error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={compose.pending}>
                <Send size={15} aria-hidden="true" />
                {compose.pending ? "Publishing…" : when ? "Schedule" : "Publish now"}
              </Button>
            </div>
          </form>
        </Card>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Announcements" action={<span className="font-normal text-faint">Pinned on Home</span>} />
            {announcements.length ? (
              <ul className="flex flex-col">
                {announcements.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 border-b border-line py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <ThreadTag thread={isSpace(a.space) ? a.space : "House"} />
                        <span className="text-[12px] text-faint">until {formatDateTime(a.pinned_until!).split(" · ")[0]}</span>
                      </div>
                      <div className="mt-1 text-[13.5px] font-bold">{a.title}</div>
                    </div>
                    <IconBtn label={`Edit ${a.title}`} onClick={() => { edit.setError(null); setEditing(a); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px] text-faint">No announcements. Tick “Pin as an announcement” when you publish.</span>
            )}
          </Card>
          <Card>
            <CardHeader title="Sent" />
            {log.length ? (
              <ul className="flex flex-col">
                {log.map((s) => (
                  <li key={s.id} className="border-b border-line py-2 last:border-b-0">
                    <div className="text-[13.5px] font-bold">{s.title}</div>
                    <span className="text-[12.5px] text-faint">
                      {s.channels.map((c) => (c === "feed" ? "Feed" : `Email (${s.emails_sent}${s.emails_failed ? `, ${s.emails_failed} failed` : ""})`)).join(", ")} · {s.by} · {relativeWhen(s.sent_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px] text-faint">Nothing sent yet.</span>
            )}
          </Card>
        </aside>
      </div>

      <h2 className="mt-2 text-[15px] font-extrabold">Feed posts</h2>
      <TableBox minWidth={760} head={["Post", "Space", "Shows from", "Status", "Actions"]} empty={!posts.length && "No posts yet."}>
        {posts.map((p) => {
          const later = new Date(p.published_at).getTime() > now;
          return (
            <tr key={p.id} className="border-b border-line last:border-b-0">
              <td className={td}><b className="block">{p.title}</b><span className="text-faint">{p.kind}{p.pinned_until && new Date(p.pinned_until).getTime() > now ? " · Pinned" : ""}</span></td>
              <td className={td}><ThreadTag thread={isSpace(p.space) ? p.space : "House"} /></td>
              <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(p.published_at)}</td>
              <td className={td}>
                <StatusPill tone={p.status === "published" ? (later ? "blue" : "ok") : "draft"}>{p.status === "published" ? (later ? "Scheduled" : "Published") : "Draft"}</StatusPill>
              </td>
              <td className={td}>
                <RowActions
                  name={p.title}
                  published={p.status === "published"}
                  onEdit={() => { edit.setError(null); setEditing(p); }}
                  onDuplicate={() => edit.run(() => duplicatePost(p.id))}
                  onToggle={() => edit.run(() => setPostStatus(p.id, p.status === "published" ? "draft" : "published"))}
                  onDelete={() => setDel(p)}
                />
              </td>
            </tr>
          );
        })}
      </TableBox>

      <EditorDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="Publishing · Feed post"
        title="Edit post"
        pending={edit.pending}
        error={edit.error}
        formKey={editing?.id ?? "none"}
        onSubmit={(fd) => edit.run(() => savePost(fd), () => setEditing(null))}
      >
        {editing ? (
          <>
            <input type="hidden" name="id" value={editing.id} />
            <PostFields p={editing} />
            <TextField label="Shows in the feed from (Cairo time)" name="published_at" type="datetime-local" defaultValue={isoToCairoLocal(editing.published_at)} />
            <SelectField label="Status" name="status" defaultValue={editing.status} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
            <p className="text-[12.5px] text-faint">Editing changes the feed only. Emails already sent stay as they were.</p>
          </>
        ) : null}
      </EditorDrawer>

      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={edit.pending} onConfirm={() => del && edit.run(() => deletePost(del.id), () => setDel(null))} />

      <Modal
        open={confirmEmail}
        onClose={() => setConfirmEmail(false)}
        title="Send this email?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmEmail(false)}>Not yet</Button>
            <Button disabled={compose.pending} onClick={() => { setConfirmEmail(false); send(); }}>Send to {subscribers}</Button>
          </>
        }
      >
        <p className="text-[13.5px]">It goes to <b>{subscribers}</b> member{subscribers === 1 ? "" : "s"} who chose The Floor Notes, each with an unsubscribe link. Emails can&apos;t be recalled once sent.</p>
      </Modal>
    </>
  );
}

function Channel({ name, label, defaultChecked, checked, onChange, disabled }: { name?: string; label: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-line2 bg-card px-3 text-[12.5px] font-bold desk:h-[30px] ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-hover"}`}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        disabled={disabled}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}
