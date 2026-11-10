import type { Metadata } from "next";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminWaitlist, qqLog, qqStages } from "@/lib/brickr/queries";
import { LogManager, StagesManager, WaitlistTable } from "./quidquo-admin";

export const metadata: Metadata = { title: "QuidQuo admin" };

export default async function AdminQuidQuoPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const base = await currentAdminBase();
  const { tab: raw } = await searchParams;
  const tab = raw === "log" || raw === "waitlist" ? raw : "stages";
  const [stages, log, waitlist] = await Promise.all([qqStages(), qqLog(true), adminWaitlist()]);
  return (
    <>
      <PageHeader above={<ThreadTag thread="QuidQuo" />} title="QuidQuo" description="The progress members follow, the build log, and the waitlist." />
      <LinkTabs
        label="QuidQuo admin sections"
        value={tab}
        hrefFor={(v) => `${base}/quidquo${v === "stages" ? "" : `?tab=${v}`}`}
        items={[
          { value: "stages", label: "Stages", count: stages.length },
          { value: "log", label: "Build log", count: log.length },
          { value: "waitlist", label: "Waitlist", count: waitlist.length },
        ]}
      />
      {tab === "stages" ? <StagesManager stages={stages} /> : null}
      {tab === "log" ? <LogManager entries={log} /> : null}
      {tab === "waitlist" ? <WaitlistTable rows={waitlist} /> : null}
    </>
  );
}
