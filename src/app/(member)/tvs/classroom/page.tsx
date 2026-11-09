import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Classroom" };

export default function ClassroomPage() {
  return (
    <Placeholder
      title="TVAC classroom"
      description="Modules, assignments, live sessions, documents and recordings." thread="TVS"
      phase="Phase 6"
      items={[
        "Modules & progress",
        "Assignments & submissions with feedback",
        "Live sessions with Google Meet",
        "Documents & recordings",
        "Reminders and cohort discussion"
      ]}
    />
  );
}
