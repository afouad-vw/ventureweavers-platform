import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "TVS admin" };

export default async function AdminTvsPage() {
  await requireAdmin();
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
