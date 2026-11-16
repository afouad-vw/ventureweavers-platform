"use client";

import { useCallback, useEffect, useState } from "react";
import { Conversation } from "@/components/messages/conversation";
import { useMessagesLive } from "@/components/messages/use-messages-live";
import type { Message } from "@/lib/messages/format";
import { fetchMyConversation, markMyMessagesRead, sendMyMessage } from "./actions";

export function MemberMessages({ initial, threadId: initialThread }: { initial: Message[]; threadId: string | null }) {
  const [messages, setMessages] = useState(initial);
  const [threadId, setThreadId] = useState(initialThread);

  const reload = useCallback(async () => {
    const r = await fetchMyConversation().catch(() => null);
    if (!r) return;
    setThreadId(r.threadId);
    setMessages((old) => {
      if (r.messages.length !== old.length || r.messages.at(-1)?.id !== old.at(-1)?.id) {
        if (r.messages.some((m) => m.from_team)) void markMyMessagesRead();
        return r.messages;
      }
      return old;
    });
  }, []);

  useEffect(() => {
    void markMyMessagesRead();
  }, []);
  useMessagesLive(threadId, reload);

  return (
    <Conversation
      className="flex-1"
      viewer="member"
      messages={messages}
      onSend={async (body) => {
        const r = await sendMyMessage(body);
        if (r.ok) await reload();
        return r;
      }}
      emptyText={
        <>
          <b className="mb-1 block text-[15px] text-fg">Ask us anything</b>
          Programs, shows, services or partnerships. Your message goes to the VentureWeavers team, and our reply shows here and in your notifications.
        </>
      }
    />
  );
}
