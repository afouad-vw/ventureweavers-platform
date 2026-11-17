import type { Metadata } from "next";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { dealsBoard, dealTargets, listCompanies, memberBusinessSuggestions, openTasks, staffNames } from "@/lib/crm/queries";
import { CompaniesList, DealsBoard, MemberBusinesses, TasksList } from "./businesses-board";

export const metadata: Metadata = { title: "Businesses" };

const TABS = ["businesses", "deals", "tasks", "members"] as const;
type Tab = (typeof TABS)[number];

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin("businesses.view");
  const manage = can(admin, "businesses.manage");
  const [{ tab: raw }, base] = await Promise.all([searchParams, currentAdminBase()]);
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "businesses";
  const [companies, deals, tasks, suggestions, names] = await Promise.all([listCompanies(), dealsBoard(), openTasks(), memberBusinessSuggestions(), staffNames()]);
  const staff = [...names.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const targets = tab === "deals" ? await dealTargets() : { services: [], programs: [] };
  const activeCompanies = companies.filter((c) => c.status === "active").map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <PageHeader title="Businesses" description="The businesses we work with, the people at them, B2B deals and the team's follow-ups." />
      <LinkTabs
        label="Businesses sections"
        value={tab}
        hrefFor={(v) => `${base}/businesses${v === "businesses" ? "" : `?tab=${v}`}`}
        items={[
          { value: "businesses", label: "Businesses", count: companies.filter((c) => c.status === "active").length },
          { value: "deals", label: "Deals", count: deals.filter((d) => ["Lead", "Qualified", "Proposal", "Negotiation"].includes(d.stage)).length },
          { value: "tasks", label: "Tasks", count: tasks.length },
          { value: "members", label: "From member profiles", count: suggestions.length },
        ]}
      />
      {tab === "businesses" ? <CompaniesList rows={companies} base={base} staff={staff} canManage={manage} /> : null}
      {tab === "deals" ? <DealsBoard deals={deals} base={base} companies={activeCompanies} staff={staff} services={targets.services} programs={targets.programs} canManage={manage} /> : null}
      {tab === "tasks" ? <TasksList tasks={tasks} base={base} canManage={manage} /> : null}
      {tab === "members" ? <MemberBusinesses items={suggestions} base={base} canManage={manage} /> : null}
    </>
  );
}
