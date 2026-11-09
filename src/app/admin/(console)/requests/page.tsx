import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <Placeholder
      title="Requests"
      description="Every meeting request, private session, application and partnership."
      phase="Phase 9"
      items={[
        "Counts by stage: New, Intro call, Proposal, Won, Declined",
        "Table and board views, filter by space",
        "Owner, notes and member notifications on every change"
      ]}
    />
  );
}
