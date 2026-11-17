"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Conversation } from "@/components/messages/conversation";
import { useMessagesLive } from "@/components/messages/use-messages-live";
import { StatusPill } from "@/components/ui/tag";
import type { Message, Thread } from "@/lib/messages/format";
import { markThreadRead, messageMember } from "../../messages/actions";

/** A member's conversation with the team, on their contact page. The team can write first. */
export function ContactMessages({ memberId, name, thread, messages, canSend, base }: { memberId: string; name: string; thread: Thread | null; messages: Message[]; canSend: boolean; base: string }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useMessagesLive(thread?.id ?? null, refresh);
  const first = name.split(" ")[0];
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (thread && thread.last_member_message_at && (!thread.team_read_at || thread.team_read_at < thread.last_member_message_at)) void markThreadRead(thread.id).then(refresh);
  }, [thread, lastId, refresh]);

  return (
    <section className="glass flex h-[min(640px,calc(100dvh-260px))] min-h-[420px] flex-col overflow-hidden rounded-2xl border" aria-label={`Messages with ${name}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
        <b className="flex-1 text-[14px]">Messages with {name}</b>
        {thread?.status === "done" ? <StatusPill tone="draft">Done</StatusPill> : null}
        {thread ? <Link href={`${base}/messages?t=${thread.id}${thread.status === "done" ? "&show=done" : ""}`} className="text-[12.5px] font-bold text-link hover:underline">Open in Messages</Link> : null}
      </div>
      <Conversation
        className="min-h-0 flex-1"
        viewer="team"
        messages={messages}
        canSend={canSend}
        placeholder={thread ? `Reply to ${first}` : `Write to ${first}`}
        emptyText={canSend ? `No messages yet. Write to ${first}; they'll see it in Messages and get a notification.` : "No messages yet."}
        onSend={async (body) => {
          const r = await messageMember(memberId, body);
          if (r.ok) refresh();
          return r;
        }}
      />
      {!canSend ? <p className="border-t border-line px-3.5 py-2.5 text-[12.5px] text-faint">You can read messages. Ask a partner for Messages (manage) access to write.</p> : null}
    </section>
  );
}
