import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscussionForm } from "@/components/blong/discussion-form";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/auth/guards";
import { SectionSoon } from "@/components/blong/review";
import { discussionPage, blongSections } from "@/lib/blong/queries";

export const metadata: Metadata = { title: "Edit discussion" };

export default async function EditDiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireMember(`/blong/discussions/${slug}/edit`);
  if (!(await blongSections()).discussions) return <SectionSoon section="discussions" />;
  const d = await discussionPage(slug);
  if (!d || d.my_status !== "active" || !["owner", "admin"].includes(d.my_role ?? "")) notFound();
  return (
    <div className="bl flex flex-col gap-4">
      <h1 className="font-display text-[26px] leading-tight font-semibold">Edit {d.title}</h1>
      <Card>
        <DiscussionForm
          id={d.id}
          slug={d.slug}
          initial={{ title: d.title, description: d.description, category: d.category, tags: d.tags, limit: d.member_limit, privacy: d.privacy, community: d.community?.id ?? null }}
        />
      </Card>
    </div>
  );
}
