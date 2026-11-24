"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { MemberAvatar } from "@/components/blong/member-avatar";
import { ReportDialog } from "@/components/blong/member-actions";
import { Conversation } from "@/components/messages/conversation";
import { cn } from "@/lib/cn";
import type { DmMessage, DmThread } from "@/lib/blong/format";
import { messageTime } from "@/lib/messages/format";
import { browserClient } from "@/lib/supabase/browser";
import { fetchChats, markChatRead, sendChatMessage } from "../blong/actions";

/** Calls `onChange` when a chat message arrives (Realtime, limited by row level security) and every 10 seconds. */
function useChatsLive(onChange: () => void) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; onChange(); }, 300);
    };
    let channel: ReturnType<ReturnType<typeof browserClient>["channel"]> | null = null;
    try {
      channel = browserClient().channel("dm_messages:mine").on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, fire).subscribe();
    } catch {
      // Realtime unavailable: the interval keeps chats fresh.
    }
    const interval = setInterval(() => document.visibilityState === "visible" && fire(), 10_000);
    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      if (channel) void browserClient().removeChannel(channel);
    };
  }, [onChange]);
}

const ago = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? messageTime(iso) : new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(d);
};

/** Messages › Members: one-to-one chats with other members. */
export function MemberChats({ me, initialThreads, initialMessages, chat }: { me: string; initialThreads: DmThread[]; initialMessages: DmMessage[]; chat: string | null }) {
  const router = useRouter();
  const [all, setThreads] = useState(initialThreads);
  const threads = useMemo(() => all.filter((t) => t.last_body || t.id === chat), [all, chat]);
  const [messages, setMessages] = useState(initialMessages);
  const [report, setReport] = useState<string | null>(null);
  const active = threads.find((t) => t.id === chat) ?? null;

  useEffect(() => { setThreads(initialThreads); }, [initialThreads]);
  useEffect(() => { setMessages(initialMessages); }, [initialMessages]);

  const reload = useCallback(async () => {
    const r = await fetchChats(chat).catch(() => null);
    if (!r) return;
    setThreads(r.threads);
    setMessages((old) => (r.messages.length !== old.length || r.messages.at(-1)?.id !== old.at(-1)?.id ? r.messages : old));
  }, [chat]);

  useEffect(() => {
    if (chat) void markChatRead(chat).then(() => setThreads((ts) => ts.map((t) => (t.id === chat ? { ...t, unread: 0 } : t))));
  }, [chat, messages.length]);
  useChatsLive(reload);

  const shown = useMemo(
    () => messages.map((m) => ({ id: m.id, body: m.body, created_at: m.created_at, from_team: m.author !== me })),
    [messages, me],
  );
  const open = (id: string) => router.push(`/messages?tab=members&chat=${id}`, { scroll: false });

  return (
    <div className="glass flex min-h-[60vh] overflow-hidden rounded-2xl border desk:h-[calc(100dvh-260px)] desk:min-h-[480px]">
      <aside className={cn("flex w-full flex-col border-line desk:w-[300px] desk:shrink-0 desk:border-r", active ? "hidden desk:flex" : "flex")} aria-label="Chats">
        {threads.length ? (
          <ul className="flex flex-col gap-0.5 overflow-y-auto p-2">
            {threads.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => open(t.id)} aria-current={t.id === chat ? "true" : undefined} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left hover:bg-hover", t.id === chat && "bg-hover")}>
                  <MemberAvatar id={t.other_id} name={t.name} src={t.avatar_url} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><b className="truncate text-[14px]">{t.name}</b><span className="shrink-0 text-[11.5px] text-faint">{ago(t.last_message_at)}</span></span>
                    <span className={cn("block truncate text-[12.5px]", t.unread ? "font-bold text-fg" : "text-faint")}>{t.last_mine ? "You: " : ""}{t.last_body}</span>
                  </span>
                  {t.unread ? <span className="bl-dot h-2.5 w-2.5 shrink-0 rounded-full" aria-label={`${t.unread} unread`} /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="m-auto max-w-[280px] p-6 text-center text-[13.5px] text-faint">
            <b className="mb-1 block text-[15px] text-fg">No chats yet</b>
            Message members from their page in <Link href="/blong/networking" className="font-bold text-link">BLong › Networking</Link>. You can message Public accounts, and Private ones that accepted your follow.
          </div>
        )}
      </aside>

      <section className={cn("min-w-0 flex-1 flex-col", active ? "flex" : "hidden desk:flex")} aria-label={active ? `Chat with ${active.name}` : "Chat"}>
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
              <button type="button" className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg hover:bg-hover desk:hidden" aria-label="All chats" onClick={() => router.push("/messages?tab=members", { scroll: false })}>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <Link href={`/blong/members/${active.other_id}`} scroll={false} className="flex min-w-0 items-center gap-2.5">
                <MemberAvatar id={active.other_id} name={active.name} src={active.avatar_url} size={34} />
                <b className="truncate text-[14px]">{active.name}</b>
              </Link>
            </div>
            <Conversation
              className="flex-1"
              viewer="member"
              theirName={active.name.split(/\s+/)[0]}
              messages={shown}
              canSend={active.can_send}
              onReport={(id) => setReport(id)}
              onSend={async (body) => {
                const r = await sendChatMessage(active.id, body);
                if (r.ok) await reload();
                return r.ok ? { ok: true } : { ok: false, error: r.error };
              }}
              emptyText={`Say hello to ${active.name.split(/\s+/)[0]}.`}
            />
            {!active.can_send ? <p className="border-t border-line px-4 py-3 text-[12.5px] text-faint">You can&apos;t reply in this chat any more.</p> : null}
            {report ? <ReportDialog open onClose={() => setReport(null)} kind="message" target={report} name={active.name} /> : null}
          </>
        ) : (
          <div className="m-auto p-6 text-center text-[13.5px] text-faint">Choose a chat.</div>
        )}
      </section>
    </div>
  );
}
