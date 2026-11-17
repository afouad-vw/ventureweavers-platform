import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, FileText, FolderOpen, Target, Video } from "lucide-react";
import { CalendlyButton } from "@/components/brickr/calendly-button";
import { AcceptProposalButton, DecideButtons, DeleteNoteButton, RaiseRequestButton, SharedNoteForm, TaskStatusSelect, TeamPeople } from "@/components/projects/member-actions";
import { CommentThread, ProposalButton } from "@/components/projects/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MiniTag, StatusPill, ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { formatDate, formatDateTime } from "@/lib/events/format";
import {
  billingLabel,
  cairoToday,
  categoryOf,
  driveEmbedUrl,
  isOverdue,
  progressOf,
  STATUS_PATH,
  taskStatusLabel,
  taskTone,
  formatMoney,
  healthOf,
  isOpenRequest,
  meetingKindLabel,
  projectStatusLabel,
  projectStatusTone,
  requestStatusLabel,
  requestTone,
  ROLE_LABEL,
  serviceLabel,
  termLine,
} from "@/lib/projects/format";
import { memberProject, type ProjectComment, type ProjectTask, type WeeklyUpdate } from "@/lib/projects/queries";
import { addComment, proposalLink, recordProjectBooking } from "../actions";

export const metadata: Metadata = { title: "Project" };

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "plan", label: "Plan & tasks" },
  { value: "scope", label: "Proposal & scope" },
  { value: "requests", label: "Requests" },
  { value: "meetings", label: "Meetings" },
  { value: "notes", label: "Notes" },
  { value: "files", label: "Project folder" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab: raw }] = await Promise.all([params, searchParams]);
  const [view, member] = await Promise.all([memberProject(slug), getMember()]);
  if (!view) notFound();
  const { project: p, role } = view;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "overview";
  const lead = role === "lead";
  const h = healthOf(p.health);
  const nameOf = new Map([[p.id, p.name], ...view.children.map((c) => [c.id, c.name] as [string, string])]);
  const multi = view.children.length > 0;
  const commentsFor = (type: string, id: string | null) => view.comments.filter((c) => c.target_type === type && c.target_id === id);
  const post = (type: "project" | "request" | "meeting" | "task" | "update", id: string | null, projectId = p.id) => async (body: string) => {
    "use server";
    return addComment(projectId, { type, id }, body);
  };
  const openReqs = view.requests.filter((r) => isOpenRequest(r.status));
  const waiting = view.requests.filter((r) => r.status === "quoted");
  const upcoming = view.meetings.filter((m) => m.status === "scheduled" && new Date(m.starts_at).getTime() > Date.now() - 3_600_000);
  const past = view.meetings.filter((m) => !upcoming.includes(m)).reverse();
  const today = cairoToday();
  const ownTasks = view.tasks.filter((t) => t.project_id === p.id);
  const progress = progressOf(ownTasks);
  const myTasks = ownTasks.filter((t) => t.owner_side === "client" && t.status !== "done" && (!t.assignee_member || t.assignee_member === member?.id));
  const latest = view.updates[0] ?? null;
  const projects = [{ id: p.id, name: p.name }, ...view.children.map((c) => ({ id: c.id, name: c.name }))];
  const at = STATUS_PATH.indexOf(p.status);
  const embed = p.drive_url ? driveEmbedUrl(p.drive_url) : null;

  return (
    <>
      <Link href="/projects" className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline"><ArrowLeft size={15} aria-hidden="true" />My projects</Link>
      <PageHeader
        above={
          <span className="flex flex-wrap items-center gap-2">
            <ThreadTag thread="BRICKR" />
            {view.parent ? <Link href={`/projects/${view.parent.slug}`} className="text-[12.5px] font-bold text-link hover:underline">{view.parent.name}</Link> : null}
          </span>
        }
        title={p.name}
        description={`${p.kind === "portfolio" ? "Portfolio" : "Venture"} · ${serviceLabel(p.service)} · You're ${ROLE_LABEL[role].toLowerCase()}`}
        actions={<span className="flex flex-wrap items-center gap-2"><StatusPill tone={projectStatusTone(p.status)}>{projectStatusLabel(p.status)}</StatusPill></span>}
      />
      <LinkTabs label="Project sections" value={tab} hrefFor={(v) => `/projects/${p.slug}${v === "overview" ? "" : `?tab=${v}`}`} items={TABS.map((t) => ({ ...t, count: t.value === "requests" ? waiting.length || null : t.value === "plan" ? myTasks.length || null : null }))} />

      {tab === "overview" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="gap-3">
              <CardHeader title="About this project" action={<span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: h.colour }} aria-hidden="true" />{h.label}</span>} />
              {p.summary ? <p className="text-[14px] whitespace-pre-line text-muted">{p.summary}</p> : null}
              {p.goals.length ? (
                <ul className="flex flex-col gap-1.5">
                  {p.goals.map((g) => <li key={g} className="flex items-start gap-2 text-[13.5px]"><Target size={15} className="mt-0.5 shrink-0 text-brk-fg" aria-hidden="true" />{g}</li>)}
                </ul>
              ) : null}
              {p.dimensions.length ? <span className="flex flex-wrap gap-1.5">{p.dimensions.map((d) => <MiniTag key={d}>{d}</MiniTag>)}</span> : null}
            </Card>
            {at >= 0 ? (
              <Card className="gap-2">
                <CardHeader title="Where we are" />
                <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label="Project path">
                  {STATUS_PATH.map((st, i) => (
                    <li key={st} className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${st === p.status ? "bg-primary text-white" : i < at ? "bg-soft text-soft-fg" : "bg-hover text-faint"}`} aria-current={st === p.status ? "step" : undefined}>{projectStatusLabel(st)}</li>
                  ))}
                </ol>
                {progress !== null ? <p className="text-[13px] text-muted"><b className="text-fg">{progress}%</b> of the plan done · {ownTasks.filter((t) => t.status !== "done").length} open tasks</p> : null}
              </Card>
            ) : null}
            {myTasks.length ? (
              <Card tone="soft" className="gap-2">
                <CardHeader title="Your team's tasks" action={<Link href={`/projects/${p.slug}?tab=plan`} className="text-[12.5px] font-bold text-link">Plan</Link>} />
                {myTasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                    <span className="min-w-0 text-[13.5px]"><b>{t.title}</b>{t.due_on ? <span className={isOverdue(t, today) ? "font-bold text-bad-fg" : "text-faint"}> · due {formatDate(t.due_on)}</span> : null}</span>
                    <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} />
                  </div>
                ))}
              </Card>
            ) : null}
            {latest ? (
              <Card className="gap-2">
                <CardHeader title={`Weekly wrap-up · week of ${formatDate(latest.week_of)}`} action={<Link href={`/projects/${p.slug}?tab=plan`} className="text-[12.5px] font-bold text-link">All</Link>} />
                <WrapUp w={latest} />
              </Card>
            ) : null}
            {waiting.length && lead ? (
              <Card tone="soft" className="gap-2">
                <CardHeader title="Waiting for your approval" />
                {waiting.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                    <span className="text-[13.5px]"><b>{r.title}</b> · {formatMoney(r.price, r.currency)}</span>
                    <Link href={`/projects/${p.slug}?tab=requests`} className="text-[13px] font-bold text-link hover:underline">Review quote</Link>
                  </div>
                ))}
              </Card>
            ) : null}
            {view.children.length ? (
              <Card>
                <CardHeader title="Ventures in this portfolio" />
                <ul className="flex flex-col">
                  {view.children.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                      <Link href={`/projects/${c.slug}`} className="text-[14px] font-bold hover:underline">{c.name}</Link>
                      <span className="flex items-center gap-2">
                        <i className="h-2 w-2 rounded-full" style={{ background: healthOf(c.health).colour }} aria-hidden="true" />
                        <StatusPill tone={projectStatusTone(c.status)}>{projectStatusLabel(c.status)}</StatusPill>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Notes and questions" />
              <CommentThread comments={commentsFor("project", null)} post={post("project", null)} placeholder="Ask the partners or share an update" />
            </Card>
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHeader title="Next meetings" action={<Link href={`/projects/${p.slug}?tab=meetings`} className="text-[12.5px] font-bold text-link">All</Link>} />
              {upcoming.length ? upcoming.slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-start gap-2 border-b border-line py-2 text-[13px] last:border-b-0">
                  <CalendarClock size={15} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                  <span><b>{m.title}</b><br /><span className="text-faint">{formatDateTime(m.starts_at)} · {m.minutes} min</span></span>
                </div>
              )) : <p className="text-[13px] text-faint">No meetings scheduled.</p>}
            </Card>
            <Card>
              <CardHeader title="At a glance" />
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div><dt className="text-[12px] font-bold text-faint">Open requests</dt><dd className="font-display text-[20px]">{openReqs.length}</dd></div>
                <div><dt className="text-[12px] font-bold text-faint">Meetings held</dt><dd className="font-display text-[20px]">{view.meetings.filter((m) => m.status === "done").length}</dd></div>
                <div className="col-span-2"><dt className="text-[12px] font-bold text-faint">Term</dt><dd>{termLine(p)}</dd></div>
              </dl>
            </Card>
            <Card>
              <CardHeader title="People" />
              <TeamPeople projectId={p.id} people={view.people} lead={lead} myId={member?.id ?? null} />
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
          <div className="flex min-w-0 flex-col gap-3">
            {(() => {
              const mine = view.milestones.filter((m) => m.project_id === p.id);
              const groups = [...mine.map((m) => ({ m, items: ownTasks.filter((t) => t.milestone_id === m.id) })), { m: null, items: ownTasks.filter((t) => !t.milestone_id || !mine.some((m) => m.id === t.milestone_id)) }].filter((g) => g.m || g.items.length);
              return groups.length ? groups.map(({ m, items }) => {
                const pct = progressOf(items);
                return (
                  <Card key={m?.id ?? "none"} className="gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {m?.dimension ? <span className="text-[11px] font-extrabold tracking-wide text-brk-fg uppercase">{m.dimension}</span> : null}
                        <b className="block text-[15px]">{m ? m.title : "Other tasks"}</b>
                        {m?.due_on ? <span className="text-[12.5px] text-faint">Due {formatDate(m.due_on)}</span> : null}
                      </div>
                      {pct !== null ? <span className="text-[12.5px] font-bold text-muted">{pct}%</span> : null}
                    </div>
                    {pct !== null ? <div className="h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div> : null}
                    <ul className="flex flex-col">
                      {items.map((t) => <TaskRow key={t.id} t={t} today={today} comments={commentsFor("task", t.id)} post={post("task", t.id, t.project_id)} />)}
                    </ul>
                  </Card>
                );
              }) : <EmptyState>The partners will share the plan here.</EmptyState>;
            })()}
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <Card className="gap-2">
              <CardHeader title="Progress" />
              <p><b className="font-display text-[26px]">{progress ?? 0}%</b> <span className="text-[12.5px] text-faint">of {ownTasks.length} tasks done</span></p>
              <p className="text-[12.5px] text-muted">{myTasks.length} open on your side. Update your tasks as you go; the partners see it straight away.</p>
            </Card>
            <Card className="gap-3">
              <CardHeader title="Weekly wrap-ups" />
              {view.updates.length ? view.updates.map((w) => (
                <div key={w.id} className="flex flex-col gap-1.5 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <b className="text-[13.5px]">Week of {formatDate(w.week_of)}</b>
                  <WrapUp w={w} />
                  <CommentThread compact comments={commentsFor("update", w.id)} post={post("update", w.id)} placeholder="Reply to this wrap-up" />
                </div>
              )) : <p className="text-[13px] text-faint">The partners post a wrap-up at the end of each week.</p>}
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === "notes" ? (
        <Card className="gap-3">
          <CardHeader title="Shared notes" />
          <p className="text-[13px] text-muted">Notes here are seen by everyone on the project and the partners.</p>
          <SharedNoteForm projectId={p.id} />
          {view.notes.length ? (
            <ul className="flex flex-col gap-2">
              {view.notes.map((n) => (
                <li key={n.id} className={`rounded-xl border px-3 py-2 ${n.pinned ? "border-primary/40 bg-soft" : "border-line"}`}>
                  <span className="flex items-center justify-between gap-2 text-[11.5px] text-faint">
                    <span><b className="text-fg">{n.author}</b> · {formatDateTime(n.created_at)}</span>
                    {n.mine ? <DeleteNoteButton id={n.id} /> : null}
                  </span>
                  <p className="text-[13.5px] whitespace-pre-line">{n.body}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-faint">No notes yet.</p>}
        </Card>
      ) : null}

      {tab === "scope" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="gap-3">
              <CardHeader title="The proposal" />
              {p.proposal_path ? (
                <>
                  <p className="flex items-center gap-2 text-[13.5px]"><FileText size={16} className="text-brk-fg" aria-hidden="true" />{p.proposal_name ?? "Proposal.pdf"}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ProposalButton getLink={async () => { "use server"; return proposalLink(p.id); }} />
                    {p.proposal_accepted_at ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-soft-fg"><CheckCircle2 size={15} aria-hidden="true" />Accepted by {view.acceptedBy ?? "the client lead"} on {formatDate(p.proposal_accepted_at)}</span>
                    ) : lead ? (
                      <AcceptProposalButton projectId={p.id} />
                    ) : (
                      <span className="text-[12.5px] text-faint">Waiting for the client lead to accept.</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[13.5px] text-faint">The partners will share the proposal here.</p>
              )}
            </Card>
            <Card className="gap-3">
              <CardHeader title="What's included" />
              {view.scope.length ? (
                <ul className="flex flex-col gap-3">
                  {view.scope.map((s) => (
                    <li key={s.id} className="flex flex-col gap-1 border-b border-line pb-3 last:border-b-0 last:pb-0">
                      {s.dimension ? <span className="text-[11.5px] font-extrabold tracking-wide text-brk-fg uppercase">{s.dimension}</span> : null}
                      <b className="text-[14.5px]">{s.title}</b>
                      {s.details ? <p className="text-[13.5px] whitespace-pre-line text-muted">{s.details}</p> : null}
                      {s.outputs.length ? <span className="flex flex-wrap gap-1.5">{s.outputs.map((o) => <MiniTag key={o}>{o}</MiniTag>)}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-faint">The scope will be listed here once the proposal is agreed.</p>
              )}
              <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-soft-fg">Anything beyond this scope is priced separately. Raise it in Requests and we&apos;ll reply with the details and price for the client lead to approve.</p>
            </Card>
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHeader title="Terms" />
              <dl className="flex flex-col gap-2 text-[13px]">
                <div><dt className="text-[12px] font-bold text-faint">Investment</dt><dd className="font-display text-[20px]">{p.retainer_amount !== null ? `${formatMoney(p.retainer_amount, p.currency)} / month` : "TBA"}</dd><dd className="text-faint">{billingLabel(p.billing)}</dd></div>
                <div><dt className="text-[12px] font-bold text-faint">Term</dt><dd>{termLine(p)}</dd></div>
                {p.cadence ? <div><dt className="text-[12px] font-bold text-faint">Cadence</dt><dd>{p.cadence}</dd></div> : null}
              </dl>
              {p.key_terms ? <p className="border-t border-line pt-2 text-[13px] whitespace-pre-line text-muted">{p.key_terms}</p> : null}
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-[640px] text-[13px] text-muted">Extra work and scope changes are priced separately: we reply with details, requirements, timeline and price, and the client lead approves before work starts. Ask for meetings, questions and documents here too.</p>
            <RaiseRequestButton projectId={p.id} projects={projects} />
          </div>
          {view.requests.length ? view.requests.map((r) => (
            <Card key={r.id} className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-extrabold tracking-wide text-brk-fg uppercase">{categoryOf(r.category).label}</span>
                  <b className="block text-[15px]">{r.title}</b>
                  <p className="text-[12.5px] text-faint">
                    {multi ? `${nameOf.get(r.project_id)} · ` : ""}{r.source === "team" ? `Logged by the partners${r.received_note ? ` (${r.received_note})` : ""}` : `Raised by ${r.raised_by_name}`} · {formatDate(r.created_at)}
                  </p>
                </div>
                <StatusPill tone={requestTone(r.status)}>{requestStatusLabel(r.status)}</StatusPill>
              </div>
              {r.details ? <p className="text-[13.5px] whitespace-pre-line text-muted">{r.details}</p> : null}
              {r.preferred_times ? <p className="text-[13px]"><b>Preferred times:</b> {r.preferred_times}</p> : null}
              {!categoryOf(r.category).priced && r.response ? (
                <div className="flex flex-col gap-1 rounded-xl border border-line bg-hover/60 p-3 text-[13.5px]">
                  <span className="text-[11.5px] font-extrabold tracking-wide text-brk-fg uppercase">Our reply</span>
                  <p className="whitespace-pre-line">{r.response}</p>
                  {r.meeting_id ? <Link href={`/projects/${p.slug}?tab=meetings`} className="text-[13px] font-bold text-link hover:underline">See it in Meetings</Link> : null}
                </div>
              ) : null}
              {categoryOf(r.category).priced && ["quoted", "approved", "client_declined", "in_progress", "done"].includes(r.status) && r.response ? (
                <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-hover/60 p-3 text-[13.5px]">
                  <span className="text-[11.5px] font-extrabold tracking-wide text-brk-fg uppercase">Our response</span>
                  <p className="whitespace-pre-line">{r.response}</p>
                  {r.requirements ? <p className="whitespace-pre-line text-muted"><b className="text-fg">What we need from you:</b> {r.requirements}</p> : null}
                  <p className="flex flex-wrap gap-x-4 gap-y-1"><span><b>Price:</b> {r.price === 0 ? "Included" : formatMoney(r.price, r.currency)}</span>{r.timeline ? <span><b>Timeline:</b> {r.timeline}</span> : null}</p>
                  {r.decided_at ? <p className="text-[12.5px] text-faint">{r.status === "client_declined" ? "Declined" : "Approved"} by {r.decided_by_name} on {formatDate(r.decided_at)}</p> : null}
                </div>
              ) : null}
              {r.status === "declined" && r.decline_reason ? <p className="rounded-xl bg-warn-bg px-3 py-2 text-[13px] text-warn-fg">{r.decline_reason}</p> : null}
              {r.status === "quoted" ? (lead ? <DecideButtons requestId={r.id} /> : <p className="text-[12.5px] text-faint">Waiting for the client lead to approve.</p>) : null}
              <CommentThread compact comments={commentsFor("request", r.id) as ProjectComment[]} post={post("request", r.id, r.project_id)} placeholder="Comment on this request" />
            </Card>
          )) : <EmptyState>No requests yet.</EmptyState>}
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted">Weekly sessions are scheduled by the partners. Need another meeting or a call? Ask for it here.</p>
            <RaiseRequestButton projectId={p.id} projects={projects} initial="meeting" label="Request a meeting" />
          </div>
          {p.calendly_url && member ? (
            <Card className="flex-row flex-wrap items-center justify-between gap-3">
              <span className="text-[13.5px]"><b>Book a session</b><br /><span className="text-faint">Pick a time that suits you in the partners&apos; calendar.</span></span>
              <CalendlyButton url={p.calendly_url} serviceId={p.id} serviceSlug={p.slug} name={member.name ?? ""} email={member.email ?? ""} label="Book a session" size="md" record={async (ev: string, inv: string) => { "use server"; return recordProjectBooking(p.id, ev, inv); }} />
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Upcoming" />
            {upcoming.length ? upcoming.map((m) => <MeetingRow key={m.id} m={m} label={multi ? nameOf.get(m.project_id) : undefined} comments={commentsFor("meeting", m.id)} post={post("meeting", m.id, m.project_id)} actions={view.tasks.filter((t) => t.meeting_id === m.id)} />) : <p className="text-[13.5px] text-faint">Nothing scheduled yet.</p>}
          </Card>
          {past.length ? (
            <Card>
              <CardHeader title="Past meetings" />
              {past.map((m) => <MeetingRow key={m.id} m={m} label={multi ? nameOf.get(m.project_id) : undefined} comments={commentsFor("meeting", m.id)} post={post("meeting", m.id, m.project_id)} actions={view.tasks.filter((t) => t.meeting_id === m.id)} />)}
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "files" ? (
        <Card className="gap-3">
          <CardHeader title="Project folder" action={p.drive_url ? <a href={p.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-bold text-link hover:underline">Open the folder<ExternalLink size={13} aria-hidden="true" /></a> : undefined} />
          {p.drive_url && embed ? (
            <>
              <p className="text-[13px] text-muted">The project&apos;s files live in Google Drive. If the list below is empty, sign in to Google with the account the folder is shared with, or ask the partners to share it with you.</p>
              <iframe title={`${p.name} project folder`} src={embed} className="h-[520px] w-full rounded-xl border border-line bg-white" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
            </>
          ) : p.drive_url ? (
            <p className="text-[13.5px] text-muted">The project&apos;s files are in a shared folder. Open it with the account it&apos;s shared with.</p>
          ) : (
            <p className="flex items-center gap-2 text-[13.5px] text-faint"><FolderOpen size={16} aria-hidden="true" />The partners will connect the project folder here.</p>
          )}
        </Card>
      ) : null}
    </>
  );
}

type Post = (body: string) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;

function WrapUp({ w }: { w: WeeklyUpdate }) {
  return (
    <div className="flex flex-col gap-1.5 text-[13.5px]">
      <p className="whitespace-pre-line">{w.summary}</p>
      {w.done ? <p className="whitespace-pre-line text-muted"><b className="text-fg">Done:</b> {w.done}</p> : null}
      {w.next ? <p className="whitespace-pre-line text-muted"><b className="text-fg">Next:</b> {w.next}</p> : null}
      {w.open_points ? <p className="rounded-lg bg-warn-bg px-3 py-2 whitespace-pre-line text-warn-fg"><b>Open points:</b> {w.open_points}</p> : null}
    </div>
  );
}

function TaskRow({ t, today, comments, post }: { t: ProjectTask; today: string; comments: ProjectComment[]; post: Post }) {
  return (
    <li className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-[13.5px]">
          <b className={t.status === "done" ? "text-faint line-through" : ""}>{t.title}</b>
          <span className="block text-[12px] text-faint">
            {t.owner_side === "client" ? "Your team" : "VentureWeavers"}{t.assignee ? ` · ${t.assignee}` : ""}{t.dimension ? ` · ${t.dimension}` : ""}
            {t.due_on ? <span className={isOverdue(t, today) ? "font-bold text-bad-fg" : ""}> · due {formatDate(t.due_on)}</span> : null}
          </span>
        </span>
        {t.owner_side === "client" ? <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} /> : <StatusPill tone={taskTone(t.status)}>{taskStatusLabel(t.status)}</StatusPill>}
      </div>
      {t.details ? <p className="text-[13px] whitespace-pre-line text-muted">{t.details}</p> : null}
      <details className="text-[12.5px]">
        <summary className="cursor-pointer font-bold text-link">Comments{comments.length ? ` (${comments.length})` : ""}</summary>
        <div className="pt-2"><CommentThread compact comments={comments} post={post} placeholder="Comment on this task" /></div>
      </details>
    </li>
  );
}

function MeetingRow({ m, label, comments, post, actions = [] }: { m: { id: string; title: string; kind: string; starts_at: string; minutes: number; meet_url: string | null; agenda: string; notes: string; status: string }; label?: string; comments: ProjectComment[]; post: Post; actions?: ProjectTask[] }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px]"><b>{m.title}</b> <span className="text-[12.5px] text-faint">· {meetingKindLabel(m.kind)}{label ? ` · ${label}` : ""}</span></span>
        {m.status === "cancelled" ? <StatusPill tone="draft">Cancelled</StatusPill> : m.status === "done" ? <StatusPill tone="ok">Done</StatusPill> : null}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1"><CalendarClock size={14} aria-hidden="true" />{formatDateTime(m.starts_at)} (Cairo) · {m.minutes} min</span>
        {m.meet_url && m.status === "scheduled" ? <a href={m.meet_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-link hover:underline"><Video size={14} aria-hidden="true" />Join</a> : null}
      </p>
      {m.agenda ? <p className="text-[13px] whitespace-pre-line"><b>Agenda:</b> {m.agenda}</p> : null}
      {m.notes ? <p className="rounded-lg bg-hover px-3 py-2 text-[13px] whitespace-pre-line"><b>Notes:</b> {m.notes}</p> : null}
      {actions.length ? (
        <div className="flex flex-col gap-0.5 text-[13px]">
          <b>Action items</b>
          {actions.map((t) => <span key={t.id}>{t.status === "done" ? "✓" : "•"} {t.title} <span className="text-faint">· {t.owner_side === "client" ? "Your team" : "VentureWeavers"} · {taskStatusLabel(t.status)}</span></span>)}
        </div>
      ) : null}
      <CommentThread compact comments={comments} post={post} placeholder="Comment on this meeting" />
    </div>
  );
}
