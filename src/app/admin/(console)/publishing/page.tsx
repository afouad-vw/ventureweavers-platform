import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/guards";
import { adminPosts, adminPublishLog, newsletterCount } from "@/lib/content/admin-queries";
import { PublishingBoard } from "./publishing-board";

export const metadata: Metadata = { title: "Publishing" };

export default async function PublishingPage() {
  await requireAdmin("publishing.manage");
  const [posts, log, subscribers] = await Promise.all([adminPosts(), adminPublishLog(), newsletterCount()]);
  return (
    <>
      <PageHeader title="Publishing" description="Send an update to the Home feed and The Floor Notes. Only members who opted in to a channel receive it." />
      <PublishingBoard posts={posts} log={log} subscribers={subscribers} emailReady={Boolean(process.env.RESEND_API_KEY)} />
    </>
  );
}
