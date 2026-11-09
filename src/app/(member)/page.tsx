import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <Placeholder
      title="Welcome to VentureWeavers"
      description="Your feed is tuned to your role, stage and interests."
      phase="Phase 5"
      items={[
        "Next-up card for your nearest booking",
        "Reminders: tickets, live sessions, assignments due, confirmed meetings",
        "Announcements pinned by the partners",
        "Personal feed filtered by space"
      ]}
    />
  );
}
