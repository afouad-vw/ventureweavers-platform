import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "BRICKR" };

export default function BrickrPage() {
  return (
    <Placeholder
      title="BRICKR"
      description="Fractional leadership from two operators." thread="BRICKR"
      phase="Phase 7"
      items={[
        "Services as content cards",
        "Request a meeting in a pop-up",
        "My requests button to My space",
        "Locked client space"
      ]}
    />
  );
}
