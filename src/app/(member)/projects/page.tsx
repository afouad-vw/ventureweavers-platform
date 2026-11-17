import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, FolderKanban, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { formatDateTime } from "@/lib/events/format";
import { healthOf, projectStatusLabel, projectStatusTone, serviceLabel } from "@/lib/projects/format";
import { myProjects } from "@/lib/projects/queries";

export const metadata: Metadata = { title: "My projects" };

/** The client's BRICKR projects: portfolios with their ventures underneath. */
export default async function ProjectsPage() {
  const all = await myProjects();
  const ids = new Set(all.map((p) => p.id));
  const tops = all.filter((p) => !p.parent_id || !ids.has(p.parent_id));
  const kids = (id: string) => all.filter((p) => p.parent_id === id);
  return (
    <>
      <PageHeader above={<ThreadTag thread="BRICKR" />} title="My projects" description="Your work with the VentureWeavers partners: proposal and scope, requests, meetings and the project folder." />
      {tops.length ? (
        <div className="flex flex-col gap-3">
          {tops.map((p) => (
            <Card key={p.id} className="gap-3">
              <ProjectRow p={p} />
              {kids(p.id).length ? (
                <ul className="flex flex-col gap-2 border-t border-line pt-3">
                  {kids(p.id).map((k) => (
                    <li key={k.id} className="rounded-xl border border-line px-3 py-2.5"><ProjectRow p={k} small /></li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>No projects yet. When you work with the partners through BRICKR, your project space appears here.</EmptyState>
      )}
    </>
  );
}

function ProjectRow({ p, small }: { p: Awaited<ReturnType<typeof myProjects>>[number]; small?: boolean }) {
  const h = healthOf(p.health);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-brk-bg text-brk-fg ${small ? "h-9 w-9" : "h-11 w-11"}`}><FolderKanban size={small ? 16 : 20} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <Link href={`/projects/${p.slug}`} className={`font-bold hover:underline ${small ? "text-[14px]" : "font-display text-[17px]"}`}>{p.name}</Link>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-faint">
          <span>{p.kind === "portfolio" ? "Portfolio" : "Venture"} · {serviceLabel(p.service)}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: h.colour }} aria-hidden="true" />{h.label}</span>
          {p.openRequests ? <span className="inline-flex items-center gap-1"><Inbox size={12} aria-hidden="true" />{p.openRequests} open requests</span> : null}
          {p.nextMeeting ? <span className="inline-flex items-center gap-1"><CalendarClock size={12} aria-hidden="true" />Next: {formatDateTime(p.nextMeeting)}</span> : null}
        </p>
      </div>
      <StatusPill tone={projectStatusTone(p.status)}>{projectStatusLabel(p.status)}</StatusPill>
    </div>
  );
}
