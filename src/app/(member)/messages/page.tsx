import type { Metadata } from "next";
import Image from "next/image";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { isUuid } from "@/lib/blong/format";
import { dmMessages, myDmThreads } from "@/lib/blong/queries";
import { myConversation, myUnreadMessages } from "@/lib/messages/queries";
import { MemberChats } from "./member-chats";
import { MemberMessages } from "./member-messages";

export const metadata: Metadata = { title: "Messages" };

/** Messages: two tabs, the conversation with the VentureWeavers team and chats with other members. */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string; chat?: string }> }) {
  const me = await requireMember("/messages");
  const { tab: raw, chat: rawChat } = await searchParams;
  const tab = raw === "members" ? "members" : "team";
  const chat = isUuid(rawChat) ? rawChat : null;
  const [threads, teamUnread] = await Promise.all([myDmThreads(), myUnreadMessages().catch(() => 0)]);
  const memberUnread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="house-hide"><PageHeader title="Messages" description="The VentureWeavers team, and members you follow." /></div>
      <LinkTabs
        label="Messages"
        value={tab}
        hrefFor={(v) => (v === "team" ? "/messages" : "/messages?tab=members")}
        items={[
          { value: "team", label: "VentureWeavers", count: tab === "team" ? null : teamUnread || null },
          { value: "members", label: "Members", count: memberUnread || null },
        ]}
      />
      {tab === "members" ? (
        <MemberChats me={me.id} initialThreads={threads} initialMessages={chat ? await dmMessages(chat) : []} chat={chat} />
      ) : (
        <TeamConversation />
      )}
    </div>
  );
}

async function TeamConversation() {
  const { thread, messages } = await myConversation();
  return (
    <div className="glass flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border desk:h-[calc(100dvh-260px)] desk:min-h-[480px]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex shrink-0">
          <Image src="/images/ahmed.jpg" alt="" width={32} height={32} className="h-8 w-8 rounded-full border-2 border-card object-cover" />
          <Image src="/images/karim.jpg" alt="" width={32} height={32} className="-ml-3 h-8 w-8 rounded-full border-2 border-card object-cover" />
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="text-[14px]">VentureWeavers team</b>
          <span className="text-[12px] text-faint">Fouad, Karim and the team · we usually reply within 1–2 working days</span>
        </span>
      </div>
      <MemberMessages initial={messages} threadId={thread?.id ?? null} />
    </div>
  );
}
