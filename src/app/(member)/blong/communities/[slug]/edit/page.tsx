import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityForm } from "@/components/blong/community-form";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/auth/guards";
import { communityPage } from "@/lib/blong/queries";

export const metadata: Metadata = { title: "Edit community" };

export default async function EditCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireMember(`/blong/communities/${slug}/edit`);
  const c = await communityPage(slug);
  if (!c || c.my_status !== "active" || !["owner", "admin"].includes(c.my_role ?? "")) notFound();
  return (
    <div className="bl flex flex-col gap-4">
      <h1 className="font-display text-[26px] leading-tight font-semibold">Edit {c.name}</h1>
      <Card>
        <CommunityForm
          id={c.id}
          slug={c.slug}
          initial={{ name: c.name, description: c.description, type: c.type, topics: c.topics, audience: c.audience, visibility: c.visibility, cover: c.cover_url }}
        />
      </Card>
    </div>
  );
}
