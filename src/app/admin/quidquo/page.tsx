import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "QuidQuo admin" };

export default function AdminQuidQuoPage() {
  return (
    <Placeholder
      title="QuidQuo"
      description="The progress members follow, the build log, and the waitlist." thread="QuidQuo"
      phase="Phase 9"
      items={[
        "Stages and progress",
        "Build log",
        "Waitlist with export"
      ]}
    />
  );
}
