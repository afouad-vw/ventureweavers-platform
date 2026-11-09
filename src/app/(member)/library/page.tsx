import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <Placeholder
      title="Library"
      description="Reports, guides, templates and AI skills from the house."
      phase="Phase 5"
      items={[
        "Search and type filters",
        "Save to My space",
        "Access by level: members, learners, clients, waitlist"
      ]}
    />
  );
}
