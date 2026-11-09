import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  return (
    <Placeholder
      title="Overview"
      description="Key numbers, what needs attention, and recent activity."
      phase="Phase 9"
      items={[
        "KPIs from real data",
        "Needs attention: questions, requests, drafts, pending payments",
        "Seats by event and contacts by space",
        "Latest activity"
      ]}
    />
  );
}
