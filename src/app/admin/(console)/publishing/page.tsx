import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Publishing" };

export default function PublishingPage() {
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
