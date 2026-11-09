import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "TVS admin" };

export default function AdminTvsPage() {
  return (
    <Placeholder
      title="TVS"
      description="Programs, masterclasses, the classroom, learners and applications." thread="TVS"
      phase="Phase 9"
      items={[
        "Programs and masterclasses",
        "Classroom: assignments, Google Meet sessions, documents",
        "Learners and progress",
        "Applications pipeline"
      ]}
    />
  );
}
