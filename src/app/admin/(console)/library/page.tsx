import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Library admin" };

export default function AdminLibraryPage() {
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
