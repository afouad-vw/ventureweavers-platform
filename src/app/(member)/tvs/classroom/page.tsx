import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CalendarPlus, FileText, Play, Video } from "lucide-react";
import { DeletePostButton, DownloadButton, PostForm, StepButton, SubmitWork } from "@/components/tvs/classroom-client";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip-link";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState, Eyebrow } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { requireMember } from "@/lib/auth/guards";
import { relativeWhen } from "@/lib/content/format";
import { formatDate, formatDateTime } from "@/lib/events/format";
import { assignmentState, isOpen, isPast, moduleStates, nextSession, overallProgress, type AssignmentState } from "@/lib/tvs/classroom";
import { loadClassroom, myClassrooms, type Classroom, type CSession } from "@/lib/tvs/classroom-queries";

export const metadata: Metadata = { title: "Classroom" };

const pillTone: Record<AssignmentState, "ok" | "blue" | "warn" | "bad" | "draft"> = { Reviewed: "ok", Submitted: "blue", Due: "warn", Overdue: "bad", Locked: "draft" };
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`;
const TABS = ["modules", "assignments", "live", "files"] as const;

export default async function ClassroomPage({ searchParams }: { searchParams: Promise<{ cohort?: string; tab?: string; module?: string }> }) {
  const me = await requireMember("/tvs/classroom");
  const sp = await searchParams;
  const mine = await myClassrooms();
  if (!mine.length) {
    return (
      <>
        <Link href="/tvs" className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline"><ArrowLeft size={15} aria-hidden="true" />TVS</Link>
        <EmptyState>
          The classroom opens once your seat in a program is confirmed. See your application in <Link href="/my-space?tab=learning" className="font-bold text-link">My learning</Link>, or{" "}
          <Link href="/tvs" className="font-bold text-link">explore programs</Link>.
        </EmptyState>
      </>
    );
  }
  const current = mine.find((c) => c.id === sp.cohort) ?? mine[0];
  const room = await loadClassroom(current.id);
  if (!room) return <EmptyState>This classroom isn&apos;t available.</EmptyState>;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "modules";
  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (mine.length > 1) p.set("cohort", current.id);
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/tvs/classroom?${s}` : "/tvs/classroom";
  };

  const now = Date.now();
  const progress = overallProgress(room.steps, room.done);
  const subByAssignment = new Map(room.submissions.map((s) => [s.assignment_id, s]));
  const openModule = new Map(room.modules.map((m) => [m.id, isOpen(m, now)]));
  const due = room.assignments.filter((a) => {
    const st = assignmentState(a, openModule.get(a.module_id) ?? false, subByAssignment.get(a.id), now);
    return st === "Due" || st === "Overdue";
  });
  const next = nextSession(room.sessions, now);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/tvs" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-link hover:underline"><ArrowLeft size={15} aria-hidden="true" />TVS</Link>
          <h1 className="font-display text-[19px] font-semibold">{room.cohort.program} classroom · {room.cohort.label}</h1>
        </div>
        <div className="flex min-w-[200px] items-center gap-2">
          <span className="text-[13px] text-faint">Progress</span>
          <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Classroom progress">
            <span className="block h-full rounded-full bg-tvs" style={{ width: `${progress}%` }} />
          </div>
          <b className="font-display text-[13px]">{progress}%</b>
        </div>
      </div>
      {mine.length > 1 ? <ChipLinks label="Your cohorts" items={mine.map((c) => ({ href: `/tvs/classroom?cohort=${c.id}`, label: `${c.program} · ${c.label}`, on: c.id === current.id }))} /> : null}
      <LinkTabs
        label="Classroom sections"
        value={tab}
        hrefFor={(v) => q(v === "modules" ? {} : { tab: v })}
        items={[
          { value: "modules", label: "Modules & progress" },
          { value: "assignments", label: "Assignments", count: due.length || null },
          { value: "live", label: "Live sessions" },
          { value: "files", label: "Documents & recordings" },
        ]}
      />

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          {tab === "modules" ? <Modules room={room} selected={sp.module} hrefFor={(id) => q({ module: id })} assignmentsHref={q({ tab: "assignments" })} /> : null}
          {tab === "assignments" ? <Assignments room={room} /> : null}
          {tab === "live" ? <Live sessions={room.sessions} next={next} /> : null}
          {tab === "files" ? <Files room={room} /> : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {next && tab !== "live" ? <NextSessionCard s={next} compact /> : null}
          <Card>
            <CardHeader title="Reminders" />
            {due.length || next ? (
              <ul className="flex flex-col">
                {due.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 border-b border-line py-2 last:border-b-0">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tvs-bg text-tvs-fg"><FileText size={14} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold">{a.title}</div>
                      <span className="text-[12px] text-faint">{a.due_at ? `Due ${formatDateTime(a.due_at)} · email the morning before` : "No due date"}</span>
                    </div>
                  </li>
                ))}
                {next ? (
                  <li className="flex items-start gap-2.5 py-2">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tvs-bg text-tvs-fg"><CalendarDays size={14} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold">Live session</div>
                      <span className="text-[12px] text-faint">{formatDateTime(next.starts_at)} · email the morning before</span>
                    </div>
                  </li>
                ) : null}
              </ul>
            ) : (
              <span className="text-[13px] text-faint">Nothing due right now.</span>
            )}
            <span className="text-[12px] text-faint">Reminders come by email for now; WhatsApp and push are coming. <Link href="/my-space?tab=profile" className="font-bold text-link">Settings</Link></span>
          </Card>
          <Card>
            <CardHeader title="Cohort discussion" />
            {room.posts.length ? (
              <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
                {room.posts.map((p) => (
                  <li key={p.id} className={cn("rounded-lg p-2.5 text-[13px]", p.is_host ? "bg-tvs-bg" : "bg-hover")}>
                    <div className="flex items-center justify-between gap-2">
                      <b className={p.is_host ? "text-tvs-fg" : undefined}>{p.author}</b>
                      <span className="flex items-center gap-1 text-[11.5px] text-faint">
                        {relativeWhen(p.created_at)}
                        {p.member_id === me.id ? <DeletePostButton id={p.id} /> : null}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line">{p.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px] text-faint">No posts yet. Ask the first question.</span>
            )}
            <PostForm cohortId={room.cohort.id} />
          </Card>
        </aside>
      </div>
    </>
  );
}

function Modules({ room, selected, hrefFor, assignmentsHref }: { room: Classroom; selected?: string; hrefFor: (id: string) => string; assignmentsHref: string }) {
  const states = moduleStates(room.modules, room.steps, room.done);
  if (!states.length) return <EmptyState>Modules appear here once the partners publish them.</EmptyState>;
  const firstOpen = [...states].reverse().find((m) => m.state !== "locked" && m.state !== "next") ?? states[0];
  const cur = states.find((m) => m.id === selected) ?? firstOpen;
  const open = cur.state !== "locked" && cur.state !== "next";
  const completed = states.filter((m) => m.state === "completed").length;
  const steps = room.steps.filter((s) => s.module_id === cur.id);
  const work = room.assignments.filter((a) => a.module_id === cur.id);
  const label = (st: string, m: { opens_at: string | null }) =>
    st === "completed" ? "Completed" : st === "in_progress" ? "In progress" : st === "open" ? "Open" : m.opens_at ? `Opens ${formatDate(m.opens_at)}` : "Opens later";
  return (
    <>
      <Card>
        <CardHeader title="Modules" action={<span className="font-normal text-faint">{completed} of {states.length} complete</span>} />
        <ul className="flex flex-col">
          {states.map((m, i) => {
            const locked = m.state === "locked" || m.state === "next";
            return (
              <li key={m.id}>
                <Link
                  href={hrefFor(m.id)}
                  scroll={false}
                  aria-current={m.id === cur.id ? "true" : undefined}
                  className={cn("flex items-center gap-3 border-b border-line px-1 py-2.5 last:border-b-0 hover:bg-hover", m.id === cur.id && "bg-hover", locked && "text-faint")}
                >
                  <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold", m.state === "completed" ? "bg-tvs text-white" : "bg-tvs-bg text-tvs-fg")}>
                    {m.state === "completed" ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] text-fg">{m.title}</b>
                    <span className="text-[12.5px] text-faint">{label(m.state, m)}</span>
                  </span>
                  <span className="hidden w-[130px] items-center gap-2 sm:flex">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full bg-tvs" style={{ width: `${m.pct}%` }} /></span>
                    <span className="w-9 text-right text-[12px] text-faint">{m.pct}%</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <Eyebrow>Module {states.indexOf(cur) + 1} of {states.length}</Eyebrow>
        <h2 className="font-display text-[17px] font-semibold">{cur.title}</h2>
        {open ? (
          <>
            {room.modules.find((m) => m.id === cur.id)?.summary ? <p className="text-[13.5px] text-muted">{room.modules.find((m) => m.id === cur.id)!.summary}</p> : null}
            {steps.length ? (
              <div className="flex flex-col gap-1.5">
                {steps.map((s) =>
                  s.url ? (
                    <div key={s.id} className="flex items-center gap-2">
                      <div className="flex-1"><StepButton id={s.id} title={s.title} meta={s.meta} done={room.done.has(s.id)} disabled={false} /></div>
                      <a href={s.url} target={s.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>Open</a>
                    </div>
                  ) : (
                    <StepButton key={s.id} id={s.id} title={s.title} meta={s.meta} done={room.done.has(s.id)} disabled={false} />
                  ),
                )}
              </div>
            ) : (
              <span className="text-[13px] text-faint">Steps for this module are on the way.</span>
            )}
            {work.length ? (
              <span className="text-[12.5px] text-faint">
                Assignment: {work.map((a) => a.title).join(", ")}. <Link href={assignmentsHref} className="font-bold text-link">Hand it in</Link>
              </span>
            ) : null}
          </>
        ) : (
          <p className="text-[13.5px] text-muted">{cur.opens_at ? `This module opens ${formatDate(cur.opens_at)}. You'll get a reminder.` : "This module opens later. You'll get a reminder."}</p>
        )}
      </Card>
    </>
  );
}

function Assignments({ room }: { room: Classroom }) {
  if (!room.assignments.length) return <EmptyState>No assignments yet.</EmptyState>;
  const modules = new Map(room.modules.map((m) => [m.id, m]));
  const subs = new Map(room.submissions.map((s) => [s.assignment_id, s]));
  return (
    <Card>
      <CardHeader title="Assignments" action={<span className="font-normal text-faint">Feedback from the partners within the week</span>} />
      <ul className="flex flex-col">
        {room.assignments.map((a) => {
          const m = modules.get(a.module_id);
          const sub = subs.get(a.id);
          const st = assignmentState(a, m ? isOpen(m) : false, sub);
          return (
            <li key={a.id} className="flex flex-wrap items-start gap-3 border-b border-line py-3 last:border-b-0">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tvs-bg text-tvs-fg"><FileText size={18} aria-hidden="true" /></span>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b className="text-[14px]">{a.title}</b>
                  <StatusPill tone={pillTone[st]}>{st}</StatusPill>
                </div>
                <span className="text-[12.5px] text-faint">
                  Module {m?.position ?? ""} · {a.due_at ? `due ${formatDateTime(a.due_at)}` : "no due date"}
                  {sub ? <> · <b className="font-semibold text-fg">{sub.file_name}</b> ({mb(sub.file_size)})</> : null}
                </span>
                {a.brief ? <p className="text-[13px] whitespace-pre-line text-muted">{a.brief}</p> : null}
                {sub?.feedback ? (
                  <div className="mt-1 rounded-lg bg-tvs-bg p-2.5 text-[13px]">
                    <b className="text-tvs-fg">Feedback</b>
                    <p className="whitespace-pre-line">{sub.feedback}</p>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sub ? <DownloadButton kind="submission" id={sub.id} label="My file" /> : null}
                {st === "Due" || st === "Overdue" || st === "Submitted" ? <SubmitWork assignmentId={a.id} replace={st === "Submitted"} /> : null}
                {st === "Locked" ? <span className="text-[12.5px] text-faint">Opens with Module {m?.position}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <span className="text-[12px] text-faint">PDF, Word, Excel, PowerPoint or ZIP, up to 20 MB. You can replace your file until it&apos;s reviewed.</span>
    </Card>
  );
}

function NextSessionCard({ s, compact }: { s: CSession; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl bg-tvs text-white", compact ? "p-3.5" : "p-4")}>
      <span className="text-[11px] font-extrabold tracking-[1.2px] text-[#C9D8F4] uppercase">Next live session</span>
      <b className={compact ? "text-[14px]" : "text-[18px]"}>{s.title}</b>
      <span className="text-[13px] text-[#DFE7F6]">{formatDateTime(s.starts_at)} Cairo · with Fouad &amp; Karim</span>
      {!compact && s.meet_url ? <span className="font-mono text-[12.5px] text-[#DFE7F6]">{s.meet_url.replace(/^https:\/\//, "")}</span> : null}
      <div className="flex flex-wrap gap-2">
        {s.meet_url ? (
          <a href={s.meet_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-bold text-ink hover:bg-[#EEF2FA]">
            <Video size={15} aria-hidden="true" />
            Join with Google Meet
          </a>
        ) : (
          <span className="text-[12.5px] text-[#DFE7F6]">The Meet link appears here before the session.</span>
        )}
        {!compact ? (
          <a href={`/api/sessions/${s.id}/calendar`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/40 px-3 text-[13px] font-bold text-white hover:bg-white/10">
            <CalendarPlus size={15} aria-hidden="true" />
            Add to calendar
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Live({ sessions, next }: { sessions: CSession[]; next: CSession | null }) {
  const upcoming = sessions.filter((s) => !isPast(s) && s.id !== next?.id);
  const past = sessions.filter((s) => isPast(s)).reverse();
  return (
    <>
      {next ? <NextSessionCard s={next} /> : <EmptyState>No live sessions scheduled yet.</EmptyState>}
      {upcoming.length ? (
        <Card>
          <CardHeader title="Upcoming" />
          <ul className="flex flex-col">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tvs-bg text-tvs-fg"><CalendarDays size={17} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">{s.title}</div>
                  <span className="text-[12.5px] text-faint">{formatDateTime(s.starts_at)} · Google Meet</span>
                </div>
                <a href={`/api/sessions/${s.id}/calendar`} className={buttonClass("secondary", "sm")}>Add to calendar</a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {past.length ? (
        <Card>
          <CardHeader title="Past sessions" />
          <ul className="flex flex-col">
            {past.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hover text-fg"><Play size={15} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">{s.title}</div>
                  <span className="text-[12.5px] text-faint">{formatDate(s.starts_at)}{s.recording_note ? ` · recording ${s.recording_note}` : ""}</span>
                </div>
                {s.recording_url ? (
                  <a href={s.recording_url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>Watch recording</a>
                ) : (
                  <span className="text-[12.5px] text-faint">Recording coming</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function Files({ room }: { room: Classroom }) {
  const modules = new Map(room.modules.map((m) => [m.id, m]));
  const recordings = room.sessions.filter((s) => s.recording_url).reverse();
  return (
    <>
      <Card>
        <CardHeader title="Documents" action={<span className="font-normal text-faint">{room.files.length} files</span>} />
        {room.files.length ? (
          <ul className="flex flex-col">
            {room.files.map((f) => {
              const ext = (/\.([a-z0-9]+)$/i.exec(f.file_name)?.[1] ?? "file").toUpperCase();
              return (
                <li key={f.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-hover text-[11px] font-extrabold text-muted">{ext.slice(0, 4)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold">{f.title}</div>
                    <span className="text-[12.5px] text-faint">{[f.module_id && modules.get(f.module_id) ? `Module ${modules.get(f.module_id)!.position}` : null, f.note, mb(f.file_size)].filter(Boolean).join(" · ")}</span>
                  </div>
                  <DownloadButton kind="file" id={f.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <span className="text-[13px] text-faint">No documents yet.</span>
        )}
      </Card>
      <Card>
        <CardHeader title="Recordings" action={<span className="font-normal text-faint">Available to your cohort</span>} />
        {recordings.length ? (
          <ul className="flex flex-col">
            {recordings.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hover text-fg"><Play size={15} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">{s.title}</div>
                  <span className="text-[12.5px] text-faint">{formatDate(s.starts_at)}{s.recording_note ? ` · ${s.recording_note}` : ""}</span>
                </div>
                <a href={s.recording_url!} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "sm")}><Play size={12} aria-hidden="true" />Watch</a>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-faint">Recordings appear after each live session.</span>
        )}
      </Card>
    </>
  );
}
