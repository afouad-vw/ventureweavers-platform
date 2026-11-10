import type { Metadata } from "next";
import { ScanLine } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminListEvents } from "@/lib/events/admin-queries";
import { adminBlog, adminContent, adminTopics } from "@/lib/content/admin-queries";
import { hostConfig } from "@/lib/hosts";
import { BlogManager } from "./blog-manager";
import { ContentManager } from "./content-manager";
import { EventsManager } from "./events-manager";
import { TopicsList } from "./topics-list";

export const metadata: Metadata = { title: "Outloud admin" };

const TABS = [
  { value: "events", label: "Events" },
  { value: "content", label: "Digital content" },
  { value: "blog", label: "Blog" },
  { value: "live", label: "Live control" },
];

export default async function AdminOutloudPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const base = await currentAdminBase();
  const { tab: raw } = await searchParams;
  const tab = TABS.some((t) => t.value === raw) ? raw! : "events";
  const [events, content, blog, topics] = await Promise.all([
    tab === "events" ? adminListEvents() : [],
    tab === "content" ? adminContent() : [],
    tab === "blog" ? adminBlog() : [],
    tab === "live" ? adminTopics() : [],
  ]);
  const appOrigin = process.env.HOST_MODE === "strict" ? `https://${hostConfig().app}` : "";
  return (
    <>
      <PageHeader
        above={<ThreadTag thread="Outloud" />}
        title="Outloud"
        description="Events, digital content and the blog. Everything you publish shows in the member app."
        actions={<LinkButton href={`${base}/check-in`} variant="secondary"><ScanLine size={15} aria-hidden="true" />Door check-in</LinkButton>}
      />
      <LinkTabs label="Outloud admin sections" items={TABS} value={tab} hrefFor={(v) => `${base}/outloud${v === "events" ? "" : `?tab=${v}`}`} />
      {tab === "events" ? <EventsManager events={events} base={base} /> : null}
      {tab === "content" ? <ContentManager items={content} /> : null}
      {tab === "blog" ? <BlogManager posts={blog} appOrigin={appOrigin} /> : null}
      {tab === "live" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <EmptyState>Live control (question queue, The Pick, polls) arrives in Phase 8.</EmptyState>
          <TopicsList topics={topics} />
        </div>
      ) : null}
    </>
  );
}
