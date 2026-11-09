import type { Metadata } from "next";
import { ScanLine } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminListEvents } from "@/lib/events/admin-queries";
import { EventsManager } from "./events-manager";

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
  const events = tab === "events" ? await adminListEvents() : [];
  return (
    <>
      <PageHeader
        above={<ThreadTag thread="Outloud" />}
        title="Outloud"
        description="Events, digital content, the blog and live control."
        actions={<LinkButton href={`${base}/check-in`} variant="secondary"><ScanLine size={15} aria-hidden="true" />Door check-in</LinkButton>}
      />
      <LinkTabs label="Outloud admin sections" items={TABS} value={tab} hrefFor={(v) => `${base}/outloud${v === "events" ? "" : `?tab=${v}`}`} />
      {tab === "events" ? <EventsManager events={events} base={base} /> : <EmptyState>{tab === "live" ? "Live control (question queue, The Pick, polls) arrives in Phase 8." : "This section arrives in Phase 5."}</EmptyState>}
    </>
  );
}
