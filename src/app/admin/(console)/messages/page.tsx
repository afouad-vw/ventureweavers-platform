import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { adminThread, adminThreads } from "@/lib/messages/queries";
import { AdminInbox } from "./admin-inbox";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ t?: string; show?: string }> }) {
  const admin = await requireAdmin("messages.view");
  const { t, show } = await searchParams;
  const [threads, base] = await Promise.all([adminThreads(), currentAdminBase()]);
  const selected = threads.find((x) => x.id === t) ?? null;
  const messages = selected ? await adminThread(selected.id) : [];
  return (
    <>
      <PageHeader title="Messages" description="Conversations with members. Replies show in the member app and in their notifications." />
      <AdminInbox
        threads={threads}
        selected={selected}
        messages={messages}
        show={show === "done" || show === "all" ? show : "open"}
        canReply={can(admin, "messages.manage")}
        base={base}
      />
    </>
  );
}
