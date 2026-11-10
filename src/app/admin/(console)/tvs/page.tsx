import type { Metadata } from "next";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminListEvents } from "@/lib/events/admin-queries";
import { adminApplications, adminCohorts, adminEnrolments, adminPrograms } from "@/lib/tvs/queries";
import { EventsManager } from "../outloud/events-manager";
import { ApplicationsBoard } from "./applications-board";
import { CohortsManager } from "./cohorts-manager";
import { LearnersTable } from "./learners-table";
import { ProgramsManager } from "./programs-manager";

export const metadata: Metadata = { title: "TVS admin" };

export default async function AdminTvsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const base = await currentAdminBase();
  const { tab: raw } = await searchParams;
  const tabs = ["programs", "classes", "cohorts", "learners", "apps"];
  const tab = tabs.includes(raw ?? "") ? raw! : "programs";

  const [programs, classes, cohorts, enrolments, applications] = await Promise.all([
    tab === "programs" || tab === "cohorts" ? adminPrograms() : [],
    tab === "classes" ? adminListEvents("masterclasses") : [],
    tab === "cohorts" || tab === "apps" ? adminCohorts() : [],
    tab === "learners" ? adminEnrolments() : [],
    adminApplications(),
  ]);
  const newApps = applications.filter((a) => a.status === "new").length;

  return (
    <>
      <PageHeader above={<ThreadTag thread="TVS" />} title="TVS" description="Programs, masterclasses, cohorts, learners and applications." />
      <LinkTabs
        label="TVS admin sections"
        value={tab}
        hrefFor={(v) => `${base}/tvs${v === "programs" ? "" : `?tab=${v}`}`}
        items={[
          { value: "programs", label: "Programs" },
          { value: "classes", label: "Masterclasses" },
          { value: "cohorts", label: "Cohorts" },
          { value: "learners", label: "Learners" },
          { value: "apps", label: "Applications", count: newApps || null },
        ]}
      />
      {tab === "programs" ? <ProgramsManager programs={programs} /> : null}
      {tab === "classes" ? <EventsManager events={classes} base={base} mode="masterclasses" /> : null}
      {tab === "cohorts" ? (
        <>
          <CohortsManager cohorts={cohorts} programs={programs.map((p) => ({ id: p.id, name: p.name }))} />
          <p className="text-[12.5px] text-faint">Modules, assignments, live sessions and documents for each cohort arrive with the classroom (Phase 6b).</p>
        </>
      ) : null}
      {tab === "learners" ? <LearnersTable enrolments={enrolments} /> : null}
      {tab === "apps" ? <ApplicationsBoard applications={applications} cohorts={cohorts} /> : null}
    </>
  );
}
