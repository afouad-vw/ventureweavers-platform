import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { companyOptions } from "@/lib/crm/queries";
import { adminProjects } from "@/lib/projects/queries";
import { ProjectsManager } from "./projects-manager";

export const metadata: Metadata = { title: "Projects" };

export default async function AdminProjectsPage() {
  const admin = await requireAdmin("projects.view");
  const base = await currentAdminBase();
  const [projects, companies] = await Promise.all([adminProjects(), can(admin, "businesses.view") || can(admin, "projects.manage") ? companyOptions() : []]);
  const portfolios = projects.filter((p) => p.kind === "portfolio").map((p) => ({ value: p.id, label: p.name }));
  return (
    <>
      <PageHeader above={<ThreadTag thread="BRICKR" />} title="Client projects" description="Fractional leadership and mentorship engagements: one project per portfolio, and one per venture under it." />
      <ProjectsManager projects={projects} portfolios={portfolios} companies={companies} base={base} canManage={can(admin, "projects.manage")} />
    </>
  );
}
