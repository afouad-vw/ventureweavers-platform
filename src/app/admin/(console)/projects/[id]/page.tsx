import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { ProposalButton } from "@/components/projects/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { MiniTag, StatusPill, ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { companyOptions } from "@/lib/crm/queries";
import { formatDate } from "@/lib/events/format";
import { billingLabel, cairoToday, formatMoney, healthOf, isOpenRequest, isOverdue, progressOf, projectStatusLabel, projectStatusTone, serviceLabel, termLine } from "@/lib/projects/format";
import { adminProject, adminProjects } from "@/lib/projects/queries";
import { adminProposalLink } from "../actions";
import { FolderPanel, PlanPanel, StatusPanel, WrapUpsPanel } from "./plan-admin";
import { MeetingsPanel, NotesPanel, PeoplePanel, ProjectComments, ProjectHeaderActions, RequestsPanel, ScopePanel } from "./project-admin";

export const metadata: Metadata = { title: "Project" };

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "plan", label: "Plan & tasks" },
  { value: "scope", label: "Proposal & scope" },
  { value: "requests", label: "Requests" },
  { value: "meetings", label: "Meetings" },
  { value: "notes", label: "Notes" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function AdminProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin("projects.view");
  const manage = can(admin, "projects.manage");
  const [{ id }, { tab: raw }, base] = await Promise.all([params, searchParams, currentAdminBase()]);
  const view = await adminProject(id);
  if (!view) notFound();
  const { project: p } = view;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "overview";
  const [all, companies] = manage ? await Promise.all([adminProjects(), companyOptions()]) : [[], []];
  const portfolios = all.filter((x) => x.kind === "portfolio").map((x) => ({ value: x.id, label: x.name }));
  const projectNames: Record<string, string> = Object.fromEntries([[p.id, p.name], ...view.children.map((c) => [c.id, c.name])]);
  const own = view.people.filter((m) => m.project_id === p.id);
  const inherited = view.people.filter((m) => m.project_id !== p.id);
  const h = healthOf(p.health);
  const quoted = view.requests.filter((r) => r.status === "quoted").length;
  const newReqs = view.requests.filter((r) => r.status === "submitted").length;
  const comments = view.comments.map((c) => ({ ...c }));
  const today = cairoToday();
  const ownTasks = view.tasks.filter((t) => t.project_id === p.id);
  const progress = progressOf(ownTasks);
  const meetingOptions = view.meetings.filter((m) => m.project_id === p.id).map((m) => ({ value: m.id, label: `${m.title} (${formatDate(m.starts_at)})` }));
  const due = ownTasks.filter((t) => t.status !== "done" && t.due_on).sort((a, b) => (a.due_on! < b.due_on! ? -1 : 1)).slice(0, 6);

  return (
    <>
      <Link href={`${base}/projects`} className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline"><ArrowLeft size={15} aria-hidden="true" />Projects</Link>
      <Card className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <ThreadTag thread="BRICKR" />
              {view.parent ? <Link href={`${base}/projects/${view.parent.id}`} className="text-[12.5px] font-bold text-link hover:underline">{view.parent.name}</Link> : null}
            </span>
            <h1 className="font-display text-xl font-semibold desk:text-[22px]">{p.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              {p.kind === "portfolio" ? "Portfolio" : "Venture"} · {serviceLabel(p.service)}
              {view.company ? <> · <Link href={`${base}/businesses/${view.company.id}`} className="text-link hover:underline">{view.company.name}</Link></> : null}
              <StatusPill tone={projectStatusTone(p.status)}>{projectStatusLabel(p.status)}</StatusPill>
              <span className="inline-flex items-center gap-1 font-bold"><i className="h-2 w-2 rounded-full" style={{ background: h.colour }} aria-hidden="true" />{h.label}</span>
            </p>
            <a href={`https://${process.env.APP_HOST ?? "app.ventureweavers.com"}/projects/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-link hover:underline">Client view: /projects/{p.slug}<ExternalLink size={12} aria-hidden="true" /></a>
          </div>
          {manage ? <ProjectHeaderActions project={p} portfolios={portfolios} companies={companies} base={base} /> : null}
        </div>
        <dl className="grid gap-3 border-t border-line pt-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {([
            ["Retainer", p.retainer_amount !== null ? `${formatMoney(p.retainer_amount, p.currency)}/mo` : "TBA", termLine(p)],
            ["Open requests", String(view.requests.filter((r) => isOpenRequest(r.status)).length), quoted ? `${quoted} waiting for the client` : newReqs ? `${newReqs} new` : ""],
            ["Plan", progress === null ? "No plan" : `${progress}%`, ownTasks.length ? `${ownTasks.filter((t) => isOverdue(t, today)).length} overdue · ${ownTasks.filter((t) => t.status === "blocked").length} blocked` : ""],
            ["Meetings held", String(view.meetings.filter((m) => m.status === "done").length), ""],
            ["Client people", String(own.length + inherited.length), ""],
          ] as const).map(([l, v, sub]) => (
            <div key={l}><dt className="text-[12px] font-bold text-faint">{l}</dt><dd><b className="font-display text-[20px]">{v}</b>{sub ? <span className="block text-[12px] text-faint">{sub}</span> : null}</dd></div>
          ))}
        </dl>
      </Card>
      <LinkTabs label="Project sections" value={tab} hrefFor={(v) => `${base}/projects/${p.id}${v === "overview" ? "" : `?tab=${v}`}`} items={TABS.map((t) => ({ ...t, count: t.value === "requests" ? newReqs || null : t.value === "notes" ? view.notes.filter((n) => !n.staff).length || null : null }))} />

      {tab === "overview" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_340px] desk:gap-[18px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="gap-2">
              <CardHeader title="About" />
              {p.summary ? <p className="text-[13.5px] whitespace-pre-line text-muted">{p.summary}</p> : <p className="text-[13px] text-faint">No summary yet.</p>}
              {p.goals.length ? <ul className="list-disc pl-5 text-[13.5px]">{p.goals.map((g) => <li key={g}>{g}</li>)}</ul> : null}
              <span className="flex flex-wrap gap-1.5">{p.dimensions.map((d) => <MiniTag key={d}>{d}</MiniTag>)}</span>
            </Card>
            {view.children.length || p.kind === "portfolio" ? (
              <Card>
                <CardHeader title="Venture projects" />
                {view.children.length ? (
                  <ul className="flex flex-col">
                    {view.children.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                        <Link href={`${base}/projects/${c.id}`} className="text-[14px] font-bold hover:underline">{c.name}</Link>
                        <StatusPill tone={projectStatusTone(c.status)}>{projectStatusLabel(c.status)}</StatusPill>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[13px] text-faint">No ventures yet. Create a venture project and pick this portfolio.</p>}
              </Card>
            ) : null}
            <Card className="gap-2">
              <CardHeader title="Coming up" action={<Link href={`${base}/projects/${p.id}?tab=plan`} className="text-[12.5px] font-bold text-link">Plan</Link>} />
              {due.length ? (
                <ul className="flex flex-col">
                  {due.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-[13px] last:border-b-0">
                      <span className="min-w-0"><b>{t.title}</b> <span className="text-faint">· {t.owner_side === "client" ? "Client" : "VentureWeavers"}{t.assignee ? `, ${t.assignee}` : ""}</span></span>
                      <span className={isOverdue(t, today) ? "font-bold text-bad-fg" : "text-faint"}>{formatDate(t.due_on!)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-faint">No dated tasks. Add the plan in Plan &amp; tasks.</p>}
            </Card>
            <ProjectComments projectId={p.id} comments={comments} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <StatusPanel project={p} history={view.history} canManage={manage} />
            <PeoplePanel projectId={p.id} people={own} inherited={inherited} canManage={manage} />
            <FolderPanel projectId={p.id} url={p.drive_url} canManage={manage} />
          </aside>
        </div>
      ) : null}

      {tab === "plan" ? (
        <>
          <PlanPanel projectId={p.id} milestones={view.milestones} tasks={view.tasks} people={[...own, ...inherited]} dimensions={p.dimensions} comments={comments} canManage={manage} meetings={meetingOptions} startsOn={p.starts_on} />
          <WrapUpsPanel projectId={p.id} updates={view.updates} comments={comments} canManage={manage} />
        </>
      ) : null}

      {tab === "scope" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_340px] desk:gap-[18px]">
          <ScopePanel projectId={p.id} items={view.scope} dimensions={p.dimensions} canManage={manage} />
          <aside className="flex min-w-0 flex-col gap-4">
            <Card className="gap-2">
              <CardHeader title="Proposal" />
              {p.proposal_path ? (
                <>
                  <p className="flex items-center gap-2 text-[13.5px]"><FileText size={16} className="text-brk-fg" aria-hidden="true" />{p.proposal_name}</p>
                  <ProposalButton variant="secondary" label="Download" getLink={async () => { "use server"; return adminProposalLink(p.id); }} />
                  {p.proposal_accepted_at ? <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-soft-fg"><CheckCircle2 size={15} aria-hidden="true" />Accepted by {view.acceptedBy} on {formatDate(p.proposal_accepted_at)}</p> : <p className="text-[12.5px] text-faint">Waiting for the client lead to accept it.</p>}
                </>
              ) : <p className="text-[13px] text-faint">Upload the proposal PDF in Edit project.</p>}
            </Card>
            <Card className="gap-1.5 text-[13px]">
              <CardHeader title="Terms" />
              <p><b>{p.retainer_amount !== null ? `${formatMoney(p.retainer_amount, p.currency)} / month` : "Retainer TBA"}</b></p>
              <p className="text-faint">{billingLabel(p.billing)} · {termLine(p)}</p>
              {p.cadence ? <p>{p.cadence}</p> : null}
              {p.key_terms ? <p className="border-t border-line pt-2 whitespace-pre-line text-muted">{p.key_terms}</p> : null}
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === "requests" ? <RequestsPanel projectId={p.id} requests={view.requests} comments={comments} projectNames={projectNames} canManage={manage} defaultCurrency={p.currency} /> : null}
      {tab === "meetings" ? <MeetingsPanel projectId={p.id} meetings={view.meetings} comments={comments} projectNames={projectNames} canManage={manage} tasks={view.tasks} milestones={view.milestones} dimensions={p.dimensions} people={[...own, ...inherited]} /> : null}
      {tab === "notes" ? <NotesPanel projectId={p.id} notes={view.notes} canManage={manage} /> : null}
    </>
  );
}
