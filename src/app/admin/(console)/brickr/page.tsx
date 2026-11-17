import type { Metadata } from "next";
import { accessLists } from "@/lib/access-server";
import { calendlyUrl } from "@/lib/calendly-server";
import { adminWaitlists } from "@/lib/waitlist-server";
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
  await requireAdmin("brickr.view");
  const base = await currentAdminBase();
  const { tab: raw } = await searchParams;
  // Services come first; requests are one tab over (and in the shared Requests inbox).
  const tab = raw === "requests" ? "requests" : "services";
  const [items, services] = await Promise.all([adminInbox(), tab === "services" ? adminServices() : []]);
  const reqs = items.filter((i) => i.kind === "request");
  const ids = services.map((x) => x.id);
  const [access, waitlists, defaultCalendly] = tab === "services" ? await Promise.all([accessLists("service", ids), adminWaitlists("service", ids), calendlyUrl()]) : [{}, {}, ""];
  return (
    <>
      <PageHeader
        above={<ThreadTag thread="BRICKR" />}
        title="BRICKR"
        description="The services members can book, and their requests."
        actions={tab === "requests" ? <LinkButton href={`${base}/requests`} variant="secondary">All requests</LinkButton> : undefined}
      />
      <LinkTabs
        label="BRICKR admin sections"
        value={tab}
        hrefFor={(v) => `${base}/brickr${v === "services" ? "" : `?tab=${v}`}`}
        items={[
          { value: "services", label: "Services" },
          { value: "requests", label: "Requests", count: reqs.filter((r) => r.status === "new").length || null },
        ]}
      />
      {tab === "requests" ? <RequestsInbox items={reqs} spaces={["BRICKR", "Outloud"]} base={base} csv={false} /> : <ServicesManager services={services} access={access} waitlists={waitlists} defaultCalendly={defaultCalendly} />}
    </>
  );
}
