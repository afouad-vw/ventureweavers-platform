import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "TVS" };

export default function TvsPage() {
  return (
    <Placeholder
      title="The Venture School"
      description="Learn it in practice. Lead it in motion." thread="TVS"
      phase="Phase 6"
      items={[
        "Programs and masterclasses as content cards",
        "My learning button to My space",
        "Booking and applications"
      ]}
    />
  );
}
