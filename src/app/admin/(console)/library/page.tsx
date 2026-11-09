import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Library admin" };

export default async function AdminLibraryPage() {
  await requireAdmin();
  return (
    <Placeholder
      title="Library"
      description="Resources and who can open each one."
      phase="Phase 9"
      items={[
        "Create, edit and publish resources",
        "Access levels"
      ]}
    />
  );
}
