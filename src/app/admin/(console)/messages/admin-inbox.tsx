"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useTransition } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { Conversation } from "@/components/messages/conversation";
import { useMessagesLive } from "@/components/messages/use-messages-live";
import { Button } from "@/components/ui/button";
import { ChipLinks } from "@/components/ui/chip-link";
import { StatusPill } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import { initialsOf } from "@/lib/initials";
import type { Message } from "@/lib/messages/format";
import type { InboxThread } from "@/lib/messages/queries";
import { markThreadRead, replyToThread, setThreadStatus } from "./actions";

/** Admin › Messages: conversations on the left, the open one on the right (one at a time on phones). */
export function AdminInbox({
  threads,
  selected,
  messages,
  show,
  canReply,
  base,
}: {
  threads: InboxThread[];
  selected: InboxThread | null;
  messages: Message[];
  show: "open" | "done" | "all";
  canReply: boolean;
  base: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const href = (q: { t?: string | null; show?: string }) => {
    const p = new URLSearchParams();
    const s = q.show ?? show;
    if (s !== "open") p.set("show", s);
    if (q.t) p.set("t", q.t);
    const qs = p.toString();
    return `${base}/messages${qs ? `?${qs}` : ""}`;
  };
  const list = threads.filter((t) => show === "all" || t.status === show);
  const counts = { open: threads.filter((t) => t.status === "open").length, done: threads.filter((t) => t.status === "done").length };

  const refresh = useCallback(() => router.refresh(), [router]);
  useMessagesLive("all", refresh);

  // Opening a conversation (or a new message arriving in it) marks it read for the team.
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (selected?.unread) void markThreadRead(selected.id).then(refresh);
  }, [selected?.id, selected?.unread, lastId, refresh]);

  return (
    <div className="flex flex-col gap-3">
      <ChipLinks
        label="Show conversations"
        items={[
          { href: href({ show: "open", t: selected?.id }), label: `Open (${counts.open})`, on: show === "open" },
          { href: href({ show: "done", t: selected?.id }), label: `Done (${counts.done})`, on: show === "done" },
          { href: href({ show: "all", t: selected?.id }), label: "All", on: show === "all" },
        ]}
      />
      <div className="glass grid min-h-[60vh] overflow-hidden rounded-2xl border desk:h-[calc(100dvh-240px)] desk:min-h-[480px] desk:grid-cols-[320px_minmax(0,1fr)]">
        <ul className={cn("min-h-0 overflow-y-auto border-line desk:border-r", selected ? "hidden desk:block" : "block")} aria-label="Conversations">
          {list.length ? (
            list.map((t) => (
              <li key={t.id}>
                <Link
                  href={href({ t: t.id })}
                  aria-current={selected?.id === t.id ? "true" : undefined}
                  className={cn("flex gap-3 border-b border-line px-3.5 py-3 hover:bg-hover", selected?.id === t.id && "bg-soft")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint text-[12px] font-extrabold text-ink">
                    {t.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element -- member photo, cropped to a circle
                      <img src={t.avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      initialsOf(t.name)
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <b className={cn("min-w-0 flex-1 truncate text-[13.5px]", t.unread && "text-fg")}>{t.name}</b>
                      <span className="shrink-0 text-[11.5px] text-faint">{relativeWhen(t.last_message_at)}</span>
                    </span>
                    <span className={cn("truncate text-[12.5px]", t.unread ? "font-bold text-fg" : "text-muted")}>{t.last || "No messages"}</span>
                  </span>
                  {t.unread ? <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-teal" aria-label="Unread" /> : null}
                </Link>
              </li>
            ))
          ) : (
            <li className="p-6 text-center text-[13.5px] text-faint">{show === "done" ? "No finished conversations." : "No conversations yet. When a member writes, it shows here and info@ventureweavers.com gets an email."}</li>
          )}
        </ul>

        {selected ? (
          <section className="flex min-h-0 flex-col" aria-label={`Conversation with ${selected.name}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
              <Link href={href({ t: null })} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-hover desk:hidden" aria-label="Back to conversations">
                <ArrowLeft size={18} aria-hidden="true" />
              </Link>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[14px]">{selected.name}</b>
                {selected.email ? <span className="truncate text-[12px] text-faint">{selected.email}</span> : null}
              </span>
              {selected.status === "done" ? <StatusPill tone="draft">Done</StatusPill> : null}
              <Link href={`${base}/contacts/m-${selected.member_id}`} className="text-[12.5px] font-bold text-link hover:underline">Contact page</Link>
              {canReply ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await setThreadStatus(selected.id, selected.status === "done" ? "open" : "done");
                      if (r.ok) toast(r.message ?? "Saved");
                      else toast(r.error);
                      refresh();
                    })
                  }
                >
                  {selected.status === "done" ? <RotateCcw size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                  {selected.status === "done" ? "Reopen" : "Mark done"}
                </Button>
              ) : null}
            </div>
            <Conversation
              key={selected.id}
              className="min-h-0 flex-1"
              viewer="team"
              messages={messages}
              canSend={canReply}
              placeholder={`Reply to ${selected.name.split(" ")[0]}`}
              emptyText="No messages yet."
              onSend={async (body) => {
                const r = await replyToThread(selected.id, body);
                if (r.ok) refresh();
                return r;
              }}
            />
            {!canReply ? <p className="border-t border-line px-3.5 py-2.5 text-[12.5px] text-faint">You can read messages. Ask a partner for Messages (manage) access to reply.</p> : null}
          </section>
        ) : (
          <div className="hidden items-center justify-center p-6 text-[13.5px] text-faint desk:flex">Choose a conversation.</div>
        )}
      </div>
    </div>
  );
}
