"use client";

import { useRef, useState } from "react";
import { Bold, ExternalLink, Heading2, Italic, Link2, List, ListOrdered, Quote } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, ListBar, RowActions, TableBox, td, useRunner } from "@/components/admin/crud";
import { ImageField } from "@/components/admin/image-field";
import { Markdown } from "@/components/content/markdown";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { AUTHORS, BLOG_CATEGORIES } from "@/lib/content/format";
import { readTime } from "@/lib/content/markdown";
import type { BlogPost } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";
import { deleteBlog, duplicateBlog, saveBlog, setBlogStatus } from "../content-actions";

const today = () => new Date().toISOString().slice(0, 10);

/** Admin › Outloud › Blog: posts with Markdown, live preview, banner upload, tags and status. */
export function BlogManager({ posts, appOrigin }: { posts: BlogPost[]; appOrigin: string }) {
  const [editing, setEditing] = useState<BlogPost | "new" | null>(null);
  const [del, setDel] = useState<BlogPost | null>(null);
  const { pending, error, setError, run } = useRunner();
  const b = editing && editing !== "new" ? editing : null;

  return (
    <>
      <ListBar count={posts.length} noun="posts" newLabel="New post" onNew={() => { setError(null); setEditing("new"); }} />
      <TableBox head={["Post", "Category", "Author", "Date", "Status", "Actions"]} empty={!posts.length && "No posts yet. Write the first one."}>
        {posts.map((p) => (
          <tr key={p.id} className="border-b border-line last:border-b-0">
            <td className={td}><b className="block">{p.title}</b><span className="text-faint">{p.read_time} read</span></td>
            <td className={td}>{p.category}</td>
            <td className={`${td} text-muted`}>{p.author}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(p.published_on + "T12:00:00Z")}</td>
            <td className={td}><StatusPill tone={p.status === "published" ? "ok" : "draft"}>{p.status === "published" ? "Published" : "Draft"}</StatusPill></td>
            <td className={td}>
              <RowActions
                name={p.title}
                published={p.status === "published"}
                onEdit={() => { setError(null); setEditing(p); }}
                onDuplicate={() => run(() => duplicateBlog(p.id))}
                onToggle={() => run(() => setBlogStatus(p.id, p.status === "published" ? "draft" : "published"))}
                onDelete={() => setDel(p)}
                extra={p.status === "published" ? <a href={`${appOrigin}/outloud/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" title="View in the app" aria-label={`View ${p.title} in the app`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-hover"><ExternalLink size={15} aria-hidden="true" /></a> : null}
              />
            </td>
          </tr>
        ))}
      </TableBox>

      <EditorDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="Outloud · Blog"
        title={b ? "Edit post" : "New post"}
        pending={pending}
        error={error}
        formKey={b?.id ?? "new"}
        wide
        onSubmit={(fd) => run(() => saveBlog(fd), () => setEditing(null))}
      >
        {b ? <input type="hidden" name="id" value={b.id} /> : null}
        <TextField label="Title" name="title" defaultValue={b?.title ?? ""} required minLength={3} maxLength={160} />
        <div className="grid gap-3 sm:grid-cols-4">
          <SelectField label="Category" name="category" defaultValue={b?.category ?? "Article"} options={BLOG_CATEGORIES} />
          <SelectField label="Author" name="author" defaultValue={b?.author ?? AUTHORS[0]} options={AUTHORS} />
          <TextField label="Date" name="published_on" type="date" defaultValue={b?.published_on ?? today()} required />
          <SelectField label="Status" name="status" defaultValue={b?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
        </div>
        <TextArea label="Summary" name="summary" rows={2} defaultValue={b?.summary ?? ""} maxLength={400} hint="One or two sentences for the card and for search results." />
        <BodyEditor initial={b?.body ?? ""} initialReadTime={b?.read_time ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Tags (comma separated)" name="tags" defaultValue={b?.tags.join(", ") ?? ""} placeholder="Pricing, Fundraising" />
          <TextField label="Web address" name="slug" defaultValue={b?.slug ?? ""} placeholder="Made from the title" hint={`${appOrigin.replace(/^https?:\/\//, "")}/outloud/blog/…`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageField name="banner_url" initial={b?.banner_url ?? null} />
          <SelectField label="Photo or pattern (used when no image is uploaded)" name="banner" defaultValue={b?.banner ?? "Pattern"} options={BANNER_OPTIONS} />
        </div>
      </EditorDrawer>

      <ConfirmDelete name={del?.title} open={del !== null} onClose={() => setDel(null)} pending={pending} onConfirm={() => del && run(() => deleteBlog(del.id), () => setDel(null))} />
    </>
  );
}

function BodyEditor({ initial, initialReadTime }: { initial: string; initialReadTime: string }) {
  const [body, setBody] = useState(initial);
  const [readTimeTouched, setTouched] = useState(Boolean(initialReadTime) && initialReadTime !== readTime(initial));
  const [rt, setRt] = useState(initialReadTime || readTime(initial));
  const ref = useRef<HTMLTextAreaElement>(null);

  const change = (v: string) => {
    setBody(v);
    if (!readTimeTouched) setRt(readTime(v));
  };

  /** Wrap the selection (or insert at the cursor) with Markdown marks. */
  const wrap = (before: string, after = "", line = false) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: z, value } = el;
    const sel = value.slice(a, z) || (line ? "" : "text");
    const lead = line && a > 0 && value[a - 1] !== "\n" ? "\n" : "";
    const next = value.slice(0, a) + lead + before + sel + after + value.slice(z);
    change(next);
    requestAnimationFrame(() => {
      el.focus();
      const start = a + lead.length + before.length;
      el.setSelectionRange(start, start + sel.length);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-muted">Body</span>
        <div className="flex gap-0.5" role="toolbar" aria-label="Formatting">
          <IconBtn label="Heading" onClick={() => wrap("## ", "", true)}><Heading2 size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Bold" onClick={() => wrap("**", "**")}><Bold size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Italic" onClick={() => wrap("*", "*")}><Italic size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Bulleted list" onClick={() => wrap("- ", "", true)}><List size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Numbered list" onClick={() => wrap("1. ", "", true)}><ListOrdered size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Quote" onClick={() => wrap("> ", "", true)}><Quote size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Link" onClick={() => wrap("[", "](https://)")}><Link2 size={15} aria-hidden="true" /></IconBtn>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          ref={ref}
          name="body"
          aria-label="Body"
          value={body}
          onChange={(e) => change(e.target.value)}
          rows={18}
          maxLength={60000}
          className="min-h-[320px] w-full resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 font-mono text-[13px] leading-relaxed text-fg focus:border-primary focus:outline-none"
          placeholder={"## A heading\n\nA paragraph with **bold** and *italic* words.\n\n- A list item\n- Another one\n\n> A quote\n\n[A link](https://ventureweavers.com)"}
        />
        <div className="min-h-[320px] overflow-auto rounded-lg border border-line bg-bg p-3.5" aria-label="Preview">
          <span className="mb-2 block text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">Preview</span>
          {body.trim() ? <Markdown source={body} className="flex flex-col gap-3 text-[14px] leading-[1.65]" /> : <span className="text-[13px] text-faint">The article appears here as you write.</span>}
        </div>
      </div>
      <span className="text-[12px] text-faint">Leave an empty line between paragraphs. Pasted text works as plain paragraphs.</span>
      <TextField
        label="Read time"
        name="read_time"
        value={rt}
        onChange={(e) => { setTouched(true); setRt(e.target.value); }}
        maxLength={20}
        hint="Worked out from the length; change it if you like."
        className="max-w-[200px]"
      />
    </div>
  );
}
