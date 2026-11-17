import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Linkedin } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { MiniTag, StatusPill } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { isOpen, pipelineTotal } from "@/lib/crm/format";
import { dealTargets, getCompany, staffNames } from "@/lib/crm/queries";
import { formatDate } from "@/lib/events/format";
import { ActivityPanel, CompanyActions, DealsPanel, PeopleCard } from "./company-view";

export const metadata: Metadata = { title: "Business" };

const TABS = ["overview", "deals", "activity"] as const;
type Tab = (typeof TABS)[number];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="w-[150px] shrink-0 text-[12.5px] font-bold text-faint">{label}</dt>
      <dd className="min-w-0 text-[13.5px] break-words whitespace-pre-line">{children || "—"}</dd>
    </div>
  );
}

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin("businesses.view");
  const manage = can(admin, "businesses.manage");
  const seeContacts = can(admin, "contacts.view");
  const [{ id }, { tab: raw }, base] = await Promise.all([params, searchParams, currentAdminBase()]);
  const view = await getCompany(id);
  if (!view) notFound();
  const [names, targets] = await Promise.all([staffNames(), dealTargets()]);
  const staff = [...names.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const { company: c, people, deals, timeline } = view;
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "overview";
  const open = deals.filter((d) => isOpen(d.stage));
  const won = deals.filter((d) => d.stage === "Won");
  const tasks = timeline.filter((t) => t.kind === "task" && !t.done_at);
  const here = `${base}/businesses/${c.id}`;

  return (
    <>
      <Link href={`${base}/businesses`} className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        Businesses
      </Link>

      <Card className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-xl font-semibold desk:text-[22px]">{c.name}</h1>
            <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
              {[c.type, c.stage, c.country].filter(Boolean).join(" · ") || "Business"}
              {c.status === "archived" ? <StatusPill tone="draft">Archived</StatusPill> : null}
            </p>
            <span className="flex flex-wrap items-center gap-3 text-[13px]">
              {c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link hover:underline"><Globe size={14} aria-hidden="true" />{c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a> : null}
              {c.linkedin ? <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link hover:underline"><Linkedin size={14} aria-hidden="true" />LinkedIn</a> : null}
            </span>
            {c.relationships.length ? <span className="flex flex-wrap gap-1" aria-label="Relationship with VW">{c.relationships.map((r) => <StatusPill key={r} tone="ok">{r}</StatusPill>)}</span> : null}
            {c.tags.length ? <span className="flex flex-wrap gap-1">{c.tags.map((t) => <MiniTag key={t}>{t}</MiniTag>)}</span> : null}
          </div>
          {manage ? <CompanyActions company={c} staff={staff} base={base} /> : null}
        </div>
        <dl className="grid gap-3 border-t border-line pt-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {([
            ["Open deals", String(open.length), pipelineTotal(deals)],
            ["Won", String(won.length), ""],
            ["People", String(people.length), ""],
            ["Open tasks", String(tasks.length), ""],
          ] as const).map(([l, v, sub]) => (
            <div key={l}>
              <dt className="text-[12px] font-bold text-faint">{l}</dt>
              <dd><b className="font-display text-[22px]">{v}</b>{sub ? <span className="block text-[12px] text-faint">{sub}</span> : null}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <LinkTabs
        label="Business sections"
        value={tab}
        hrefFor={(v) => (v === "overview" ? here : `${here}?tab=${v}`)}
        items={[
          { value: "overview", label: "Overview" },
          { value: "deals", label: "Deals", count: deals.length },
          { value: "activity", label: "Activity", count: timeline.length },
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Details" />
            <dl>
              <Row label="Relationship with VW">{c.relationships.join(", ")}</Row>
              <Row label="Type">{c.type}</Row>
              {c.type === "Venture" ? <Row label="Stage">{c.stage}</Row> : null}
              <Row label="Country">{c.country}</Row>
              <Row label="Owner">{view.ownerName}</Row>
              <Row label="Added">{formatDate(c.created_at)}</Row>
              <Row label="Notes">{c.notes}</Row>
            </dl>
          </Card>
          <PeopleCard companyId={c.id} people={people} options={view.linkOptions} base={base} canManage={manage} linkPeople={seeContacts} />
          {tasks.length ? (
            <Card className="desk:col-span-2">
              <CardHeader title="Open tasks" action={<Link href={`${here}?tab=activity`} className="text-link">All activity</Link>} />
              <ActivityPanel companyId={c.id} entries={tasks} deals={[]} canManage={manage} compact />
            </Card>
          ) : null}
        </div>
      ) : null}
      {tab === "deals" ? <DealsPanel companyId={c.id} deals={deals} staff={staff} services={targets.services} programs={targets.programs} canManage={manage} /> : null}
      {tab === "activity" ? <ActivityPanel companyId={c.id} entries={timeline} deals={deals.map((d) => ({ value: d.id, label: d.title }))} canManage={manage} /> : null}
    </>
  );
}
