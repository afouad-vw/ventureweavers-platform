import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Publishing" };

export default async function PublishingPage() {
  await requireAdmin();
  return (
    <Placeholder
      title="Publishing"
      description="Updates to the feed, The Floor Notes, WhatsApp and push."
      phase="Phase 9 and Phase 10"
      items={[
        "Compose to chosen channels and audience",
        "Pin as an announcement",
        "Announcements list",
        "Sent history"
      ]}
    />
  );
}
