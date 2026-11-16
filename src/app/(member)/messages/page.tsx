import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { myConversation } from "@/lib/messages/queries";
import { MemberMessages } from "./member-messages";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireMember("/messages");
  const { thread, messages } = await myConversation();
  return (
    <>
      <PageHeader title="Messages" description="Write to the VentureWeavers team. We usually reply within 1–2 working days." />
      <div className="glass flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border desk:h-[calc(100dvh-220px)] desk:min-h-[480px]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex shrink-0">
            <Image src="/images/ahmed.jpg" alt="" width={32} height={32} className="h-8 w-8 rounded-full border-2 border-card object-cover" />
            <Image src="/images/karim.jpg" alt="" width={32} height={32} className="-ml-3 h-8 w-8 rounded-full border-2 border-card object-cover" />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="text-[14px]">VentureWeavers team</b>
            <span className="text-[12px] text-faint">Fouad, Karim and the team · replies show in your notifications</span>
          </span>
        </div>
        <MemberMessages initial={messages} threadId={thread?.id ?? null} />
      </div>
    </>
  );
}
