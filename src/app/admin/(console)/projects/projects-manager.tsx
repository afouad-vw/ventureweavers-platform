"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorDrawer, ListBar, TableBox, td, useRunner } from "@/components/admin/crud";
import { StatusPill } from "@/components/ui/tag";
import { formatDateTime } from "@/lib/events/format";
import { formatMoney, healthOf, projectStatusLabel, projectStatusTone, serviceLabel } from "@/lib/projects/format";
import type { ProjectCard } from "@/lib/projects/queries";
import { saveProject } from "./actions";
import { ProjectFields, type Option } from "./project-form";

type Row = ProjectCard & { company: string | null };

/** Admin › Projects: portfolios with their ventures under them, and New project. */
export function ProjectsManager({ projects, portfolios, companies, base, canManage }: { projects: Row[]; portfolios: Option[]; companies: Option[]; base: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const r = useRunner();
  const router = useRouter();
  const ids = new Set(projects.map((p) => p.id));
  const ordered = projects
    .filter((p) => !p.parent_id || !ids.has(p.parent_id))
    .flatMap((p) => [p, ...projects.filter((k) => k.parent_id === p.id)]);
  return (
    <>
      {canManage ? <ListBar count={projects.length} noun="projects" newLabel="New project" onNew={() => { r.setError(null); setOpen(true); }} /> : null}
      <TableBox minWidth={900} head={["Project", "Client", "Service", "Retainer", "Requests", "Next meeting", "Status"]} empty={!projects.length && "No projects yet. Create one for a client, usually from a Won BRICKR deal."}>
        {ordered.map((p) => {
          const child = Boolean(p.parent_id && ids.has(p.parent_id));
          const h = healthOf(p.health);
          return (
            <tr key={p.id} className="border-b border-line last:border-b-0">
              <td className={td}>
                <span className={`flex items-center gap-2 ${child ? "pl-5" : ""}`}>
                  {child ? <span className="text-faint" aria-hidden="true">↳</span> : null}
                  <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: h.colour }} title={h.label} />
                  <Link href={`${base}/projects/${p.id}`} className="font-bold hover:underline">{p.name}</Link>
                </span>
                <span className={`block text-[12px] text-faint ${child ? "pl-9" : "pl-4"}`}>{p.kind === "portfolio" ? "Portfolio" : "Venture"}</span>
              </td>
              <td className={`${td} text-muted`}>{p.company ?? "—"}</td>
              <td className={`${td} text-muted`}>{serviceLabel(p.service)}</td>
              <td className={`${td} whitespace-nowrap`}>{p.retainer_amount !== null ? `${formatMoney(p.retainer_amount, p.currency)}/mo` : "—"}</td>
              <td className={td}>{p.openRequests || "—"}</td>
              <td className={`${td} whitespace-nowrap text-muted`}>{p.nextMeeting ? formatDateTime(p.nextMeeting) : "—"}</td>
              <td className={td}><StatusPill tone={projectStatusTone(p.status)}>{projectStatusLabel(p.status)}</StatusPill></td>
            </tr>
          );
        })}
      </TableBox>
      <EditorDrawer
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="BRICKR · Client project"
        title="New project"
        wide
        pending={r.pending}
        error={r.error}
        formKey="new"
        onSubmit={(fd) => r.run(async () => {
          const res = await saveProject(fd);
          if (res.ok && res.id) router.push(`${base}/projects/${res.id}`);
          return res;
        }, () => setOpen(false))}
      >
        <ProjectFields p={null} portfolios={portfolios} companies={companies} />
      </EditorDrawer>
    </>
  );
}
