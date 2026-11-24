"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, CornerUpLeft, Flag, LogOut, Pin, PinOff, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { DiscussionPage, RoomMessage } from "@/lib/blong/discussions";
import { messageTime } from "@/lib/messages/format";
import { browserClient } from "@/lib/supabase/browser";
import {
  deleteDiscussion, fetchRoom, joinDiscussion, leaveDiscussion, pinRoomMessage, postRoomMessage, removeRoomMessage, setDiscussionStatus,
} from "@/app/(member)/blong/discussions/actions";
import { BookmarkButton, LikeButton, ShareButton, useViews, ViewCount } from "./engage";
import { ReportDialog } from "./member-actions";
import { MemberAvatar } from "./member-avatar";

/** Live updates for one room: Realtime (limited by row level security) plus a 10-second refresh. */
function useRoomLive(roomId: string, onChange: () => void) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; onChange(); }, 250);
    };
    let channel: ReturnType<ReturnType<typeof browserClient>["channel"]> | null = null;
    try {
      channel = browserClient()
        .channel(`room:${roomId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "discussion_messages", filter: `discussion_id=eq.${roomId}` }, fire)
        .subscribe();
    } catch {
      // Realtime unavailable: the interval keeps the room fresh.
    }
    const interval = setInterval(() => document.visibilityState === "visible" && fire(), 10_000);
    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      if (channel) void browserClient().removeChannel(channel);
    };
  }, [roomId, onChange]);
}

const dayOf = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

/** Join, Ask to join, Accept invite, Requested and Leave for a room. */
export function RoomJoin({ d }: { d: Pick<DiscussionPage, "id" | "title" | "privacy" | "my_role" | "my_status" | "status" | "members" | "member_limit"> }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; value?: unknown }>, done: (v: unknown) => string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "Something went wrong.");
      toast(done(r.value));
      router.refresh();
    });
  if (d.my_status === "active") {
    if (d.my_role === "owner") return null;
    return (
      <>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm(true)}><LogOut size={14} aria-hidden="true" />Leave</Button>
        <Modal open={confirm} onClose={() => setConfirm(false)} title={`Leave ${d.title}?`} footer={<>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirm(false); run(() => leaveDiscussion(d.id), () => "You left the discussion"); }}>Leave</Button>
        </>}>
          <p className="text-[13.5px]">{d.privacy === "public" ? "You can join again while there's room." : "To come back, you'll need to ask again or be invited."}</p>
        </Modal>
      </>
    );
  }
  if (d.status !== "open") return null;
  if (d.my_status === "requested") return <Button size="sm" variant="secondary" disabled={pending} title="Take back your request" onClick={() => run(() => leaveDiscussion(d.id), () => "Request taken back")}>Requested</Button>;
  if (d.my_status === "invited") {
    return (
      <span className="flex gap-2">
        <Button size="sm" className="bl-follow" disabled={pending} onClick={() => run(() => joinDiscussion(d.id), () => "You joined the discussion")}><Check size={14} aria-hidden="true" />Accept invite</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => leaveDiscussion(d.id), () => "Invite declined")}>Decline</Button>
      </span>
    );
  }
  if (d.privacy === "public" && d.members >= d.member_limit) return <span className="text-[13px] font-bold text-faint">Full</span>;
  return (
    <Button size="sm" className="bl-follow" disabled={pending} onClick={() => run(() => joinDiscussion(d.id), (v) => (v === "requested" ? "Request sent to the host" : "You joined the discussion"))}>
      {d.privacy === "public" ? "Join discussion" : "Ask to join"}
    </Button>
  );
}

/** The room: live messages with replies, pins and removal, and the box to write in. */
const live = (m: RoomMessage) => !m.mod_status || m.mod_status === "live";

export function Room({ d, me, initial }: { d: DiscussionPage; me: string; initial: RoomMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [pinned, setPinned] = useState(d.pinned);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const [report, setReport] = useState<RoomMessage | null>(null);
  const [sending, startSend] = useTransition();
  const [, startAct] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const toBottom = () => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; };
  const toast = useToast();
  const member = d.my_status === "active";
  const admin = member && (d.my_role === "owner" || d.my_role === "admin");
  const canPost = member && d.status === "open";

  useEffect(() => { setMessages(initial); }, [initial]);
  useEffect(() => { setPinned(d.pinned); }, [d.pinned]);

  const reload = useCallback(async () => {
    const r = await fetchRoom(d.id).catch(() => null);
    if (r) setMessages((old) => (r.length !== old.length || r.at(-1)?.id !== old.at(-1)?.id || r.some((m, i) => m.removed !== old[i]?.removed || m.mod_status !== old[i]?.mod_status) ? r : old));
  }, [d.id]);
  useRoomLive(d.id, reload);
  useViews("room_message", box, [messages.length]);

  // Open at the newest message, then follow new ones while the reader is near the bottom
  // (scrolling only the chat box, never the page around it).
  const first = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (first.current || el.scrollHeight - el.scrollTop - el.clientHeight < 240) toBottom();
    first.current = false;
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    startSend(async () => {
      const r = await postRoomMessage(d.id, body, replyTo?.id ?? null);
      if (!r.ok) return toast(r.error);
      setDraft("");
      setReplyTo(null);
      const list = await fetchRoom(d.id).catch(() => null);
      if (list) setMessages(list);
      if (list?.find((x) => x.id === r.value)?.mod_status === "held") toast("Your message is waiting for the team's review. Only you can see it for now.");
      requestAnimationFrame(toBottom);
    });
  };

  let lastDay = "";
  return (
    <div className="glass flex h-[68dvh] min-h-[380px] flex-col overflow-hidden rounded-2xl border desk:h-[calc(100dvh-300px)] desk:min-h-[460px]">
      {pinned ? (
        <div className="bl-note flex items-start gap-2.5 border-b px-4 py-2.5">
          <Pin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[13px]"><span className="text-faint">Pinned · {pinned.name}: </span><span className="line-clamp-2">{pinned.body}</span></div>
          {admin ? (
            <button type="button" className="cursor-pointer text-faint hover:text-fg" aria-label="Unpin" onClick={() => startAct(async () => { const r = await pinRoomMessage(d.id, null); if (r.ok) setPinned(null); else toast(r.error); })}>
              <PinOff size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div ref={box} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length ? messages.map((m) => {
          const day = dayOf(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.author === me;
          return (
            <div key={m.id} data-view-id={live(m) && !m.removed ? m.id : undefined}>
              {showDay ? <div className="my-2 text-center text-[11.5px] font-bold text-faint">{day}</div> : null}
              <div className="group flex items-start gap-2.5">
                <Link href={`/blong/members/${m.author}`} scroll={false} className="shrink-0"><MemberAvatar id={m.author} name={m.name} src={m.avatar_url} size={34} /></Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-faint"><b className="text-fg">{mine ? "You" : m.name}</b> · {messageTime(m.created_at)}</p>
                  {m.mod_status && m.mod_status !== "live" && !m.removed ? (
                    <p className={`bl-chip review ${m.mod_status === "held" ? "warn" : "bad"} mt-1`}>{m.mod_status === "held" ? "Waiting for review · only you can see this" : "Hidden after reports · the team will review it"}</p>
                  ) : null}
                  {m.reply_to ? (
                    <p className="mt-1 line-clamp-1 border-l-2 border-[#7c5ce0] pl-2 text-[12px] text-faint"><CornerUpLeft size={11} className="mr-1 inline" aria-hidden="true" />{m.reply_name}: {m.reply_body || "removed message"}</p>
                  ) : null}
                  {m.removed ? (
                    <p className="mt-0.5 text-[13.5px] text-faint italic">Message removed</p>
                  ) : (
                    <p className="mt-0.5 text-[14px] break-words whitespace-pre-wrap">{m.body}</p>
                  )}
                  {!m.removed && live(m) ? (
                    <span className="mt-1 flex flex-wrap items-center gap-0.5">
                      <LikeButton kind="room_message" id={m.id} liked={Boolean(m.liked)} likes={m.likes ?? 0} small />
                      {m.replies ? <span className="bl-act static text-[12px]">{m.replies} {m.replies === 1 ? "reply" : "replies"}</span> : null}
                      <ShareButton kind="room_message" id={m.id} path={`/blong/discussions/${d.slug}`} title={`Message in ${d.title}`} />
                      {m.views ? <ViewCount views={m.views} /> : null}
                      <BookmarkButton kind="room_message" id={m.id} saved={Boolean(m.saved)} />
                    </span>
                  ) : null}
                  {!m.removed ? (
                    <span className="mt-1 flex flex-wrap gap-3 text-[12px] font-bold text-faint opacity-100 desk:opacity-0 desk:group-hover:opacity-100 desk:group-focus-within:opacity-100">
                      {canPost && live(m) ? <button type="button" className="cursor-pointer hover:text-fg" onClick={() => setReplyTo(m)}>Reply</button> : null}
                      {admin && live(m) ? (
                        <button type="button" className="cursor-pointer hover:text-fg" onClick={() => startAct(async () => {
                          const r = await pinRoomMessage(d.id, m.id);
                          if (!r.ok) return toast(r.error);
                          setPinned({ id: m.id, body: m.body, name: m.name });
                        })}>Pin</button>
                      ) : null}
                      {mine || admin ? (
                        <button type="button" className="cursor-pointer hover:text-fg" onClick={() => startAct(async () => {
                          const r = await removeRoomMessage(m.id);
                          if (!r.ok) return toast(r.error);
                          await reload();
                        })}><Trash2 size={11} className="mr-0.5 inline" aria-hidden="true" />Remove</button>
                      ) : null}
                      {!mine && live(m) ? <button type="button" className="cursor-pointer hover:text-fg" onClick={() => setReport(m)}><Flag size={11} className="mr-0.5 inline" aria-hidden="true" />Report</button> : null}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }) : (
          <p className="m-auto max-w-[300px] text-center text-[13.5px] text-faint">{canPost ? "Start the conversation." : "No messages yet."}</p>
        )}
      </div>

      {canPost ? (
        <div className="border-t border-line p-3">
          {replyTo ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-hover px-2.5 py-1.5 text-[12.5px]">
              <CornerUpLeft size={13} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Replying to <b>{replyTo.name}</b>: {replyTo.body}</span>
              <button type="button" className="cursor-pointer" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={14} aria-hidden="true" /></button>
            </div>
          ) : null}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="sr-only" htmlFor="room-draft">Message the room</label>
            <textarea
              id="room-draft"
              value={draft}
              maxLength={2000}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message the room"
              className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-line2 bg-card/70 px-3 py-2.5 text-[14px] outline-none focus:border-primary"
            />
            <Button type="submit" className={cn("bl-follow h-10 w-10 p-0")} aria-label="Send" disabled={sending || !draft.trim()}><Send size={16} aria-hidden="true" /></Button>
          </form>
        </div>
      ) : (
        <p className="border-t border-line px-4 py-3 text-[12.5px] text-faint">
          {d.status === "closed" ? "This discussion is closed. You can still read it." : d.status === "archived" ? "This discussion is archived."
            : d.status === "pending" ? "Posting opens once the team approves this discussion." : d.status === "declined" ? "This discussion wasn't approved." : "Join the discussion to post."}
        </p>
      )}
      {report ? <ReportDialog open onClose={() => setReport(null)} kind="room_message" target={report.id} name={report.name} /> : null}
    </div>
  );
}

/** Close or reopen (owners and admins); archive, restore and delete (owner); Report (everyone else). */
export function RoomManage({ d }: { d: Pick<DiscussionPage, "id" | "title" | "status" | "my_role" | "my_status" | "archived_by_team"> }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "delete" | "archive">(null);
  const [report, setReport] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const admin = d.my_status === "active" && (d.my_role === "owner" || d.my_role === "admin");
  const owner = d.my_status === "active" && d.my_role === "owner";
  const run = (status: "open" | "closed" | "archived" | "delete", msg: string) =>
    start(async () => {
      const r = status === "delete" ? await deleteDiscussion(d.id) : await setDiscussionStatus(d.id, status);
      if (!r.ok) return toast(r.error);
      toast(msg);
      if (status === "delete") router.push("/blong/discussions?tab=owned", { scroll: false });
      router.refresh();
    });
  return (
    <span className="flex flex-wrap gap-2">
      {admin && d.status === "open" ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("closed", "Discussion closed")}>Close discussion</Button> : null}
      {admin && d.status === "closed" ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("open", "Discussion reopened")}>Reopen</Button> : null}
      {owner && (d.status === "open" || d.status === "closed") ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm("archive")}>Archive</Button> : null}
      {owner && d.status === "archived" && !d.archived_by_team ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("open", "Discussion restored")}>Restore</Button> : null}
      {owner ? <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirm("delete")}><Trash2 size={14} aria-hidden="true" />Delete</Button> : null}
      {!owner && (d.status === "open" || d.status === "closed") ? <Button size="sm" variant="ghost" onClick={() => setReport(true)}><Flag size={14} aria-hidden="true" />Report</Button> : null}
      <ReportDialog open={report} onClose={() => setReport(false)} kind="discussion" target={d.id} name={d.title} />
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "delete" ? `Delete ${d.title}?` : `Archive ${d.title}?`} footer={<>
        <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
        {confirm === "delete"
          ? <Button variant="danger" disabled={pending} onClick={() => { setConfirm(null); run("delete", "Discussion deleted"); }}>Delete for good</Button>
          : <Button disabled={pending} onClick={() => { setConfirm(null); run("archived", "Discussion archived"); }}>Archive</Button>}
      </>}>
        <p className="text-[13.5px]">
          {confirm === "delete"
            ? "This removes the discussion and every message in it for everyone. It can't be undone. Closing or archiving keeps it."
            : "It leaves Explore and nobody can post or join. You can restore it any time."}
        </p>
      </Modal>
    </span>
  );
}
