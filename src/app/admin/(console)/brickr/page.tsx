import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminInbox, adminServices } from "@/lib/brickr/queries";
import { RequestsInbox } from "../requests/inbox";
import { ServicesManager } from "./services-manager";

export const metadata: Metadata = { title: "BRICKR admin" };

export default async function AdminBrickrPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const base = await currentAdminBase();
  const { tab: raw } = await searchParams;
  const tab = raw === "services" ? "services" : "requests";
  const [items, services] = await Promise.all([tab === "requests" ? adminInbox() : [], tab === "services" ? adminServices() : []]);
  const reqs = items.filter((i) => i.kind === "request");
  return (
    <>
      <PageHeader
        above={<ThreadTag thread="BRICKR" />}
        title="BRICKR"
        description="Service requests and the services members can book."
        actions={tab === "requests" ? <LinkButton href={`${base}/requests`} variant="secondary">All requests</LinkButton> : undefined}
      />
      <LinkTabs
        label="BRICKR admin sections"
        value={tab}
        hrefFor={(v) => `${base}/brickr${v === "requests" ? "" : `?tab=${v}`}`}
        items={[
          { value: "requests", label: "Requests", count: reqs.filter((r) => r.status === "new").length || null },
          { value: "services", label: "Services" },
        ]}
      />
      {tab === "requests" ? <RequestsInbox items={reqs} spaces={["BRICKR", "Outloud"]} base={base} csv={false} /> : <ServicesManager services={services} />}
    </>
  );
}
