import type { Metadata } from "next";
import { CommunityForm } from "@/components/blong/community-form";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Create a community" };

export default async function NewCommunityPage() {
  await requireMember("/blong/communities/new");
  return (
    <div className="bl flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[26px] leading-tight font-semibold">Create a community</h1>
        <p className="text-[14px] text-muted">Bring people together around a topic, an industry, a role or a place. You&apos;ll be its owner.</p>
      </div>
      <Card><CommunityForm /></Card>
    </div>
  );
}
