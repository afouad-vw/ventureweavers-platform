import type { Metadata } from "next";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminListEvents } from "@/lib/events/admin-queries";
import { ChipLinks } from "@/components/ui/chip-link";
import { EmptyState } from "@/components/ui/misc";
import { cohortLearnerProgress, loadClassroom } from "@/lib/tvs/classroom-queries";
import { adminApplications, adminCohorts, adminEnrolments, adminPrograms, peopleById } from "@/lib/tvs/queries";
import { ClassroomAdmin, type AdminRoom } from "./classroom-admin";
import { EventsManager } from "../outloud/events-manager";
import { ApplicationsBoard } from "./applications-board";
import { CohortsManager } from "./cohorts-manager";
import { LearnersTable } from "./learners-table";
import { ProgramsManager } from "./programs-manager";

export const metadata: Metadata = { title: "TVS admin" };

export default async function AdminTvsPage({ searchParams }: { searchParams: Promise<{ tab?: string; cohort?: string }> }) {
  await requireAdmin();
  const base = await currentAdminBase();
  const { tab: raw, cohort: cohortParam } = await searchParams;
  const tabs = ["programs", "classes", "classroom", "cohorts", "learners", "apps"];
  const tab = tabs.includes(raw ?? "") ? raw! : "programs";

  const [programs, classes, cohorts, enrolments, applications] = await Promise.all([
    tab === "programs" || tab === "cohorts" ? adminPrograms() : [],
    tab === "classes" ? adminListEvents("masterclasses") : [],
    tab === "cohorts" || tab === "apps" || tab === "classroom" ? adminCohorts() : [],
    tab === "learners" ? adminEnrolments() : [],
    adminApplications(),
  ]);
  const newApps = applications.filter((a) => a.status === "new").length;

  let room: AdminRoom | null = null;
  const chosen = tab === "classroom" ? cohorts.find((c) => c.id === cohortParam) ?? cohorts.find((c) => c.status === "running") ?? cohorts[0] : undefined;
  if (chosen) {
    const [data, learners] = await Promise.all([loadClassroom(chosen.id, { admin: true }), cohortLearnerProgress(chosen.id)]);
    if (data) {
      const people = await peopleById(data.submissions.map((x) => x.member_id));
      room = {
        cohortId: chosen.id,
        modules: data.modules,
        steps: data.steps,
        assignments: data.assignments,
        submissions: data.submissions.map((x) => ({ ...x, member: people.get(x.member_id)?.name ?? "Member" })),
        sessions: data.sessions,
        files: data.files,
        posts: data.posts,
        learners,
        otherCohorts: cohorts.filter((c) => c.id !== chosen.id).map((c) => ({ id: c.id, label: `${c.program} · ${c.label}` })),
      };
    }
  }

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
          { value: "classroom", label: "Classroom" },
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
          <p className="text-[12.5px] text-faint">Modules, assignments, live sessions and documents for each cohort are in the Classroom tab.</p>
        </>
      ) : null}
      {tab === "classroom" ? (
        cohorts.length ? (
          <>
            <ChipLinks label="Cohort" items={cohorts.map((c) => ({ href: `${base}/tvs?tab=classroom&cohort=${c.id}`, label: `${c.program} · ${c.label}`, on: c.id === chosen?.id }))} />
            {room ? <ClassroomAdmin room={room} /> : <EmptyState>This cohort couldn&apos;t be loaded.</EmptyState>}
          </>
        ) : (
          <EmptyState>Create a cohort first (Cohorts tab).</EmptyState>
        )
      ) : null}
      {tab === "learners" ? <LearnersTable enrolments={enrolments} /> : null}
      {tab === "apps" ? <ApplicationsBoard applications={applications} cohorts={cohorts} /> : null}
    </>
  );
}
