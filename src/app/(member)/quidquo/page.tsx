import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "QuidQuo" };

export default function QuidQuoPage() {
  return (
    <Placeholder
      title="QuidQuo"
      description="AI for raising capital, built in the open." thread="QuidQuo"
      phase="Phase 7"
      items={[
        "Four-stage progress tracker",
        "Build log",
        "Waitlist with role and email"
      ]}
    />
  );
}
