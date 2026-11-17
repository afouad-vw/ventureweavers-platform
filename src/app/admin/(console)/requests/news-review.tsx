"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, Eye, PencilLine } from "lucide-react";
import { TableBox, td, useRunner } from "@/components/admin/crud";
import { Markdown } from "@/components/content/markdown";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField, Toggle } from "@/components/ui/field";
import { Drawer } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/events/format";
import { draftBody, NEWS_SECTIONS, NEWS_STATUS, startSection, type NewsStatus } from "@/lib/news/format";
import { declineNews, saveNews } from "./news-actions";

type Item = {
  id: string;
  business_name: string;
  news_type: string;
  headline: string;
  news_date: string;
  summary: string;
  details: string;
  link: string | null;
  image_url: string | null;
  preferred: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: NewsStatus;
  decline_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  memberName: string;
  memberKey: string;
  reviewer: string | null;
  post: { slug: string; title: string; summary: string; body: string; category: string; author: string; banner_url: string | null; status: string } | null;
};

const FILTERS = [
  { value: "open", label: "To review" },
  { value: "published", label: "Published" },
  { value: "declined", label: "Not published" },
  { value: "all", label: "All" },
] as const;

export function NewsReview({ items, base, canEdit, appUrl }: { items: Item[]; base: string; canEdit: boolean; appUrl: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useMemo(
    () => items.filter((n) => (filter === "all" ? true : filter === "open" ? n.status === "submitted" || n.status === "in_review" : n.status === filter)),
    [items, filter],
  );
  const count = (f: string) => items.filter((n) => (f === "all" ? true : f === "open" ? n.status === "submitted" || n.status === "in_review" : n.status === f)).length;
  const open = items.find((n) => n.id === openId) ?? null;

  return (
    <>
      <p className="text-[13px] text-muted">News members shared about their businesses. Edit it, then publish it to the VW Newsletter or VW Notes, or decline it with a note. The member is told either way.</p>
      <div className="no-scrollbar flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={cn("h-8 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold whitespace-nowrap", filter === f.value ? "border-primary bg-soft text-fg" : "border-line2 text-faint hover:text-fg")}>
            {f.label} ({count(f.value)})
          </button>
        ))}
      </div>
      <TableBox minWidth={860} head={["Headline", "Business", "Type", "Wants", "Sent", "Status", ""]} empty={!list.length && (items.length ? "Nothing here." : "No news shared yet. Members share news from My space › My news or the Outloud blog.")}>
        {list.map((n) => (
          <tr key={n.id} className="border-b border-line last:border-b-0 hover:bg-hover">
            <td className={td}>
              <button type="button" onClick={() => setOpenId(n.id)} className="cursor-pointer text-left font-bold hover:underline">{n.headline}</button>
              <span className="block max-w-[340px] truncate text-[12px] text-faint">{n.summary}</span>
            </td>
            <td className={td}>
              {n.business_name}
              <Link href={`${base}/contacts/${n.memberKey}`} className="block text-[12px] font-bold text-link hover:underline">{n.memberName}</Link>
            </td>
            <td className={`${td} text-muted`}>{n.news_type}</td>
            <td className={`${td} text-muted`}>{n.preferred}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(n.created_at)}</td>
            <td className={td}><StatusPill tone={NEWS_STATUS[n.status].tone}>{NEWS_STATUS[n.status].label}</StatusPill></td>
            <td className={`${td} text-right`}>
              <Button variant="secondary" size="sm" onClick={() => setOpenId(n.id)}>{canEdit && (n.status === "submitted" || n.status === "in_review") ? "Review" : "Open"}</Button>
            </td>
          </tr>
        ))}
      </TableBox>
      {open ? <NewsDrawer key={open.id} item={open} base={base} canEdit={canEdit} appUrl={appUrl} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0 sm:flex-row sm:gap-3">
      <dt className="w-[130px] shrink-0 text-[12px] font-bold text-faint">{label}</dt>
      <dd className="min-w-0 text-[13.5px] break-words whitespace-pre-line">{children || "—"}</dd>
    </div>
  );
}

function NewsDrawer({ item: n, base, canEdit, appUrl, onClose }: { item: Item; base: string; canEdit: boolean; appUrl: string; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, setError, run } = useRunner();
  const form = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState(n.post?.body ?? draftBody(n));
  const [preview, setPreview] = useState(false);
  const [useImage, setUseImage] = useState(Boolean(n.post ? n.post.banner_url : n.image_url));
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const editable = canEdit && (n.status === "submitted" || n.status === "in_review" || n.status === "published");
  const image = n.post?.banner_url ?? n.image_url;
  const sectionNow = n.post ? (n.post.category === "Newsletter" ? "Newsletter" : "VW Notes") : startSection(n.preferred);
  const save = (publish: boolean) => {
    if (!form.current) return;
    if (!form.current.reportValidity()) return;
    const fd = new FormData(form.current);
    fd.set("body", body);
    if (useImage && image) fd.set("banner_url", image);
    run(() => saveNews(fd, publish), () => { router.refresh(); if (publish) onClose(); });
  };

  return (
    <Drawer
      open
      wide
      onClose={() => { setError(null); onClose(); }}
      eyebrow="Business news"
      title={n.headline}
      footer={
        editable && !declining ? (
          <>
            {n.status !== "published" ? <Button variant="ghost" onClick={() => setDeclining(true)}>Decline</Button> : null}
            <Button variant="secondary" disabled={pending} onClick={() => save(false)}>{n.status === "published" ? "Save changes" : "Save draft"}</Button>
            {n.status !== "published" ? <Button disabled={pending} onClick={() => save(true)}>{pending ? "Saving…" : "Approve and publish"}</Button> : null}
          </>
        ) : declining ? (
          <>
            <Button variant="secondary" onClick={() => setDeclining(false)}>Back</Button>
            <Button variant="danger" disabled={pending} onClick={() => run(() => declineNews(n.id, note), () => { router.refresh(); onClose(); })}>{pending ? "Declining…" : "Decline and tell the member"}</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={NEWS_STATUS[n.status].tone}>{NEWS_STATUS[n.status].label}</StatusPill>
          {n.reviewer && n.reviewed_at ? <span className="text-[12px] text-faint">by {n.reviewer}, {formatDate(n.reviewed_at)}</span> : null}
          {n.post?.status === "published" ? (
            <a href={`${appUrl}/outloud/blog/${n.post.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-link hover:underline">
              View the post <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
        </div>

        <section aria-label="What the member sent" className="rounded-xl border border-line p-3">
          <h3 className="mb-1 text-[13px] font-extrabold">What {n.memberName.split(" ")[0]} sent</h3>
          <dl>
            <Detail label="Business">{n.business_name}</Detail>
            <Detail label="Type">{n.news_type}</Detail>
            <Detail label="Date of the news">{formatDate(n.news_date + "T12:00:00Z")}</Detail>
            <Detail label="Headline">{n.headline}</Detail>
            <Detail label="Summary">{n.summary}</Detail>
            <Detail label="Details">{n.details}</Detail>
            <Detail label="Link">{n.link ? <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">{n.link}</a> : null}</Detail>
            <Detail label="Image">
              {n.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- member's uploaded image, cropped
                <img src={n.image_url} alt="" className="aspect-video w-[220px] rounded-lg border border-line object-cover" />
              ) : null}
            </Detail>
            <Detail label="Wants it in">{n.preferred}</Detail>
            <Detail label="Contact">
              <span className="flex flex-col">
                <Link href={`${base}/contacts/${n.memberKey}`} className="font-bold text-link hover:underline">{n.contact_name}</Link>
                <a href={`mailto:${n.contact_email}`} className="text-link hover:underline">{n.contact_email}</a>
                {n.contact_phone ? <span>{n.contact_phone}</span> : null}
              </span>
            </Detail>
            <Detail label="Sent">{formatDate(n.created_at)}</Detail>
          </dl>
        </section>

        {n.status === "declined" ? (
          <p className="rounded-lg bg-hover px-3 py-2 text-[13px]"><b>Declined.</b> {n.decline_note ? `Note to the member: ${n.decline_note}` : "No note was sent."}</p>
        ) : null}

        {declining ? (
          <TextArea label="Note to the member (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} hint="Shown in their My space. For example: what's missing, or why it doesn't fit right now." />
        ) : editable ? (
          <form ref={form} className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
            <h3 className="text-[13px] font-extrabold">The post</h3>
            <input type="hidden" name="id" value={n.id} />
            <TextField label="Headline" name="title" required minLength={3} maxLength={160} defaultValue={n.post?.title ?? n.headline} />
            <TextArea label="Summary" name="summary" rows={2} maxLength={400} defaultValue={n.post?.summary ?? n.summary} hint="Shown on the card and in the newsletter." />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Section" name="section" defaultValue={sectionNow} options={NEWS_SECTIONS} hint={`They asked for: ${n.preferred}`} />
              <TextField label="Author line" name="author" maxLength={120} defaultValue={n.post?.author ?? n.business_name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-muted">Text (Markdown)</span>
                <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
                  {preview ? <PencilLine size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  {preview ? "Edit" : "Preview"}
                </Button>
              </div>
              {preview ? (
                <div className="min-h-[200px] rounded-lg border border-line p-3"><Markdown source={body} /></div>
              ) : (
                <textarea aria-label="Text (Markdown)" value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="w-full rounded-lg border border-line2 bg-card p-2.5 font-mono text-[13px] focus:border-primary focus:outline-none" />
              )}
            </div>
            {image ? <Toggle label="Use their image as the banner" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} /> : null}
            {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
            {n.status === "published" ? <p className="text-[12.5px] text-faint">It&apos;s live: saving changes updates the published post.</p> : null}
          </form>
        ) : !canEdit ? (
          <p className="text-[12.5px] text-faint">You can read submissions. Content (manage) access is needed to edit and publish them.</p>
        ) : null}
        {declining && error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
      </div>
    </Drawer>
  );
}
