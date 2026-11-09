import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireMember } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Live" };

export default async function LivePage() {
  await requireMember("/live");
  return (
    <Placeholder
      title="Live mode"
      description="Ask, vote and follow the show from your phone." thread="Outloud"
      phase="Phase 8"
      items={[
        "On stage now",
        "Polls",
        "Questions with upvotes, shown after approval",
        "Ask the floor"
      ]}
    />
  );
}
