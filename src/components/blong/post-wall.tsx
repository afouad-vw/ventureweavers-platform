"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Flag, ImagePlus, Link2, MessageCircleOff, MoreHorizontal, Pencil, Pin, PinOff, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { POST_LIMITS, threadComments, type PostComment, type WallPost } from "@/lib/blong/communities";
import { messageTime } from "@/lib/messages/format";
import { putSigned } from "@/lib/put-signed";
import { checkUpload } from "@/lib/uploads";
import { finishCover, startCover } from "@/app/(member)/blong/communities/actions";
import {
  addComment, createPost, fetchComments, fetchWall, removeComment, removePost, setCommunityPosting, setPostFlags, updatePost,
} from "@/app/(member)/blong/posts-actions";
import { BookmarkButton, CommentCount, LikeButton, ShareButton, useViews, ViewCount } from "./engage";
import { ReportDialog } from "./member-actions";
import { MemberAvatar } from "./member-avatar";

type Wall = { id: string; slug: string; name: string; posting: "members" | "admins"; member: boolean; admin: boolean };

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(new Date(iso));
const when = (iso: string) => {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  return mins < 60 * 24 ? messageTime(iso) : day(iso);
};
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** The Posts tab: composer, then posts with likes, comments, shares, views and saves. */
export function PostWall({ c, me, initial, focus }: { c: Wall; me: string; initial: WallPost[]; focus?: string | null }) {
  const [posts, setPosts] = useState(initial);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setPosts(initial), [initial]);
  useViews("post", box, [posts.length]);
  const reload = async () => { const r = await fetchWall(c.id); if (r) setPosts(r); };
  const canPost = c.member && (c.posting === "members" || c.admin);

  return (
    <div className="flex flex-col gap-3" ref={box}>
      {c.admin ? <PostingSetting c={c} /> : null}
      {canPost ? <Composer community={c.id} onDone={reload} /> : (
        <p className="bl-note rounded-xl border px-3.5 py-2.5 text-[13px]">
          {!c.member ? "Join the community to post and comment." : "Only the community's owner and admins post here. You can like, comment and share."}
        </p>
      )}
      {focus && posts.length === 1 ? (
        <Link href={`/blong/communities/${c.slug}?tab=posts`} scroll={false} className="text-[13px] font-bold text-link">See all posts</Link>
      ) : null}
      {posts.length ? posts.map((p) => <PostCard key={p.id} p={p} c={c} me={me} open={focus === p.id} onChange={reload} />) : (
        <p className="rounded-[20px] border border-dashed border-line2 px-5 py-9 text-center text-[13.5px] text-faint">No posts yet.{canPost ? " Start the conversation." : ""}</p>
      )}
    </div>
  );
}

function PostingSetting({ c }: { c: Wall }) {
  const [admins, setAdmins] = useState(c.posting === "admins");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[13px]">
      <span><b>Only admins post</b><span className="block text-[12px] text-faint">Members can still like, comment and share. Good for announcements.</span></span>
      <input type="checkbox" role="switch" className="bl-switch" checked={admins} disabled={pending} onChange={(e) => {
        const next = e.target.checked;
        setAdmins(next);
        start(async () => {
          const r = await setCommunityPosting(c.id, next ? "admins" : "members");
          if (!r.ok) { setAdmins(!next); return toast(r.error); }
          toast(next ? "Only admins post now" : "Every member can post");
          router.refresh();
        });
      }} />
    </label>
  );
}

/** Write a post: text, an optional link and an optional image. */
function Composer({ community, onDone, edit, onCancel }: {
  community: string; onDone: () => void | Promise<void>; edit?: WallPost; onCancel?: () => void;
}) {
  const [body, setBody] = useState(edit?.body ?? "");
  const [link, setLink] = useState(edit?.link_url ?? "");
  const [showLink, setShowLink] = useState(Boolean(edit?.link_url));
  const [image, setImage] = useState<string | null>(edit?.image_url ?? null);
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const upload = (f: File) =>
    startUpload(async () => {
      const bad = checkUpload("content-images", f.name, f.size);
      if (bad) return toast(bad);
      const s = await startCover(f.name, f.size);
      if (!s.ok) return toast(s.error);
      if (!(await putSigned(s.url, s.contentType, f))) return toast("The upload didn't go through. Check your connection and try again.");
      const done = await finishCover(s.path);
      if (!done.ok) return toast(done.error);
      setImage(done.url);
    });

  const submit = () =>
    start(async () => {
      const r = edit ? await updatePost(edit.id, body, link, image) : await createPost(community, body, link, image);
      if (!r.ok) return toast(r.error);
      if (!edit) { setBody(""); setLink(""); setShowLink(false); setImage(null); }
      await onDone();
      toast(edit ? "Post updated" : "Posted");
    });

  return (
    <form className="glass flex flex-col gap-2.5 rounded-[20px] border p-3.5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={POST_LIMITS.body}
        rows={edit ? 4 : 3}
        placeholder="Share an update, a question or something useful with the community"
        aria-label="Post"
        className="min-h-20 w-full resize-y rounded-xl border border-line2 bg-card/70 px-3 py-2.5 text-[14px] outline-none focus:border-primary"
      />
      {showLink ? (
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" aria-label="Link" className="h-9 rounded-xl border border-line2 bg-card/70 px-3 text-[13.5px] outline-none focus:border-primary" />
      ) : null}
      {image ? (
        <span className="relative block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- member upload, cropped */}
          <img src={image} alt="" className="max-h-40 rounded-xl object-cover" />
          <button type="button" className="absolute top-1.5 right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-black/60 text-white" aria-label="Remove image" onClick={() => setImage(null)}><X size={14} aria-hidden="true" /></button>
        </span>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex gap-1">
          <button type="button" className="bl-act" onClick={() => setShowLink((v) => !v)} aria-pressed={showLink}><Link2 size={15} aria-hidden="true" /><span>Link</span></button>
          <button type="button" className="bl-act" onClick={() => file.current?.click()} disabled={uploading}><ImagePlus size={15} aria-hidden="true" /><span>{uploading ? "Uploading" : "Image"}</span></button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[12px] text-faint">{body.length}/{POST_LIMITS.body}</span>
          {onCancel ? <Button type="button" size="sm" variant="secondary" onClick={onCancel}>Cancel</Button> : null}
          <Button type="submit" size="sm" className="bl-follow" disabled={pending || uploading || !body.trim()}>{edit ? "Save" : "Post"}</Button>
        </span>
      </div>
    </form>
  );
}

function PostCard({ p, c, me, open: open0, onChange }: { p: WallPost; c: Wall; me: string; open: boolean; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(open0);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [commentCount, setCommentCount] = useState(p.comments);
  const [pending, start] = useTransition();
  const toast = useToast();
  const mine = p.author === me;
  const live = p.mod_status === "live";
  const path = `/blong/communities/${c.slug}?tab=posts&post=${p.id}`;
  useEffect(() => setCommentCount(p.comments), [p.comments]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      setMenu(false);
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "Something went wrong.");
      toast(msg);
      await onChange();
    });

  if (editing) return <Composer community={c.id} edit={p} onDone={async () => { setEditing(false); await onChange(); }} onCancel={() => setEditing(false)} />;

  return (
    <article id={`post-${p.id}`} data-view-id={live ? p.id : undefined} className={cn("glass flex flex-col gap-2.5 rounded-[20px] border p-4", open0 && "bl-focus")}>
      <header className="flex items-start gap-2.5">
        <Link href={`/blong/members/${p.author}`} scroll={false} className="shrink-0"><MemberAvatar id={p.author} name={p.name} src={p.avatar_url} size={38} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={`/blong/members/${p.author}`} scroll={false} className="text-[14px] font-extrabold hover:underline">{mine ? "You" : p.name}</Link>
          <p className="text-[12px] text-faint">{when(p.created_at)}{p.edited_at ? " · edited" : ""}{p.pinned ? <> · <Pin size={11} className="inline" aria-hidden="true" /> Pinned</> : null}{p.comments_closed ? " · comments closed" : ""}</p>
          {!live ? <p className={`bl-chip review ${p.mod_status === "held" ? "warn" : "bad"} mt-1`}>{p.mod_status === "held" ? "Waiting for review · only you can see this" : "Hidden after reports · the team will review it"}</p> : null}
        </div>
        {(mine || c.admin || live) ? (
          <span className="relative">
            <button type="button" className="bl-act" aria-label="More" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><MoreHorizontal size={16} aria-hidden="true" /></button>
            {menu ? (
              <span className="absolute top-8 right-0 z-10 flex min-w-[190px] flex-col rounded-xl border border-line bg-card p-1 shadow-lg" role="menu">
                {mine ? <button type="button" role="menuitem" className="bl-menu" onClick={() => { setMenu(false); setEditing(true); }}><Pencil size={14} aria-hidden="true" />Edit</button> : null}
                {c.admin && live ? <button type="button" role="menuitem" className="bl-menu" disabled={pending} onClick={() => act(() => setPostFlags(p.id, { pinned: !p.pinned }), p.pinned ? "Unpinned" : "Pinned to the top")}>{p.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}{p.pinned ? "Unpin" : "Pin to top"}</button> : null}
                {c.admin && live ? <button type="button" role="menuitem" className="bl-menu" disabled={pending} onClick={() => act(() => setPostFlags(p.id, { commentsClosed: !p.comments_closed }), p.comments_closed ? "Comments open" : "Comments closed")}><MessageCircleOff size={14} aria-hidden="true" />{p.comments_closed ? "Open comments" : "Close comments"}</button> : null}
                {mine || c.admin ? <button type="button" role="menuitem" className="bl-menu" disabled={pending} onClick={() => act(() => removePost(p.id), "Post removed")}><Trash2 size={14} aria-hidden="true" />Remove</button> : null}
                {!mine && live ? <button type="button" role="menuitem" className="bl-menu" onClick={() => { setMenu(false); setReport(true); }}><Flag size={14} aria-hidden="true" />Report</button> : null}
              </span>
            ) : null}
          </span>
        ) : null}
      </header>

      <p className="text-[14.5px] break-words whitespace-pre-wrap">{p.body}</p>
      {p.link_url ? (
        <a href={p.link_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="bl-linkcard flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px]">
          <ExternalLink size={14} aria-hidden="true" /><span className="min-w-0 truncate"><b>{host(p.link_url)}</b> <span className="text-faint">{p.link_url}</span></span>
        </a>
      ) : null}
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- member upload, cropped
        <img src={p.image_url} alt="" loading="lazy" className="max-h-[420px] w-full rounded-xl object-cover" />
      ) : null}

      {live ? (
        <footer className="flex flex-wrap items-center gap-1 border-t border-line pt-2">
          <LikeButton kind="post" id={p.id} liked={p.liked} likes={p.likes} />
          <CommentCount count={commentCount} onClick={() => setOpen((v) => !v)} />
          <ShareButton kind="post" id={p.id} path={path} title={`Post in ${c.name}`} shares={p.shares} />
          <span className="ml-auto flex items-center gap-1">
            <ViewCount views={p.views} />
            <BookmarkButton kind="post" id={p.id} saved={p.saved} />
          </span>
        </footer>
      ) : null}
      {open && live ? <Comments post={p} c={c} me={me} onCount={setCommentCount} /> : null}
      {report ? <ReportDialog open onClose={() => setReport(false)} kind="post" target={p.id} name={`${p.name}'s post`} /> : null}
    </article>
  );
}

function Comments({ post, c, me, onCount }: { post: WallPost; c: Wall; me: string; onCount: (n: number) => void }) {
  const [list, setList] = useState<PostComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [report, setReport] = useState<PostComment | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const load = async () => {
    const r = await fetchComments(post.id);
    if (r) { setList(r); onCount(r.filter((x) => x.mod_status === "live").length); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [post.id]);
  const canComment = c.member && !post.comments_closed;

  const send = () =>
    start(async () => {
      const r = await addComment(post.id, draft, replyTo?.id ?? null);
      if (!r.ok) return toast(r.error);
      setDraft("");
      setReplyTo(null);
      await load();
    });

  const item = (k: PostComment, reply = false) => (
    <li key={k.id} className={cn("flex items-start gap-2", reply && "ml-9")}>
      <Link href={`/blong/members/${k.author}`} scroll={false} className="shrink-0"><MemberAvatar id={k.author} name={k.name} src={k.avatar_url} size={reply ? 26 : 30} /></Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-xl bg-hover px-3 py-2">
          <p className="text-[12px]"><b>{k.author === me ? "You" : k.name}</b> <span className="text-faint">· {when(k.created_at)}</span></p>
          <p className="text-[13.5px] break-words whitespace-pre-wrap">{k.body}</p>
          {k.mod_status !== "live" ? <p className={`bl-chip review ${k.mod_status === "held" ? "warn" : "bad"} mt-1`}>{k.mod_status === "held" ? "Waiting for review" : "Hidden after reports"}</p> : null}
        </div>
        {k.mod_status === "live" ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] font-bold text-faint">
            <LikeButton kind="comment" id={k.id} liked={k.liked} likes={k.likes} small />
            {canComment ? <button type="button" className="cursor-pointer hover:text-fg" onClick={() => setReplyTo(k)}>Reply</button> : null}
            {k.author === me || post.author === me || c.admin ? (
              <button type="button" className="cursor-pointer hover:text-fg" onClick={() => start(async () => { const r = await removeComment(k.id); if (!r.ok) return toast(r.error); await load(); })}>Remove</button>
            ) : null}
            {k.author !== me ? <button type="button" className="cursor-pointer hover:text-fg" onClick={() => setReport(k)}>Report</button> : null}
          </span>
        ) : null}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
      {list === null ? <p className="text-[12.5px] text-faint">Loading comments…</p> : list.length ? (
        <ul className="flex flex-col gap-2.5">
          {threadComments(list).map(({ comment, replies }) => [item(comment), ...replies.map((r) => item(r, true))])}
        </ul>
      ) : <p className="text-[12.5px] text-faint">No comments yet.</p>}
      {canComment ? (
        <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) send(); }}>
          {replyTo ? (
            <span className="flex items-center gap-2 text-[12px] text-faint">Replying to <b className="text-fg">{replyTo.name}</b>
              <button type="button" className="cursor-pointer" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={13} aria-hidden="true" /></button>
            </span>
          ) : null}
          <span className="flex items-end gap-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={POST_LIMITS.comment} rows={1} placeholder="Write a comment" aria-label="Comment"
              className="max-h-32 min-h-9 flex-1 resize-none rounded-xl border border-line2 bg-card/70 px-3 py-2 text-[13.5px] outline-none focus:border-primary"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) send(); } }} />
            <Button type="submit" size="sm" className="bl-follow h-9 w-9 p-0" aria-label="Send comment" disabled={pending || !draft.trim()}><Send size={15} aria-hidden="true" /></Button>
          </span>
        </form>
      ) : post.comments_closed ? <p className="text-[12.5px] text-faint">Comments are closed.</p> : !c.member ? <p className="text-[12.5px] text-faint">Join the community to comment.</p> : null}
      {report ? <ReportDialog open onClose={() => setReport(null)} kind="comment" target={report.id} name={`${report.name}'s comment`} /> : null}
    </div>
  );
}
