import type { Metadata } from "next";
import { DiscussionForm } from "@/components/blong/discussion-form";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/auth/guards";
import { SectionSoon } from "@/components/blong/review";
import { listCommunities, blongSections } from "@/lib/blong/queries";

export const metadata: Metadata = { title: "Start a discussion" };

export default async function NewDiscussionPage({ searchParams }: { searchParams: Promise<{ community?: string }> }) {
  await requireMember("/blong/discussions/new");
  if (!(await blongSections()).discussions) return <SectionSoon section="discussions" />;
  const { community } = await searchParams;
  const mine = (await listCommunities("joined")).filter((c) => c.my_status === "active" && c.status === "active");
  return (
    <div className="bl flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[26px] leading-tight font-semibold">Start a discussion</h1>
        <p className="text-[14px] text-muted">A room to talk one topic through with the people who care about it. You&apos;ll be its host.</p>
      </div>
      <Card>
        <DiscussionForm communities={mine.map((c) => ({ id: c.id, name: c.name }))} community={mine.some((c) => c.id === community) ? community : null} />
      </Card>
    </div>
  );
}
