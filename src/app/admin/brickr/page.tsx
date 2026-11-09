import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "BRICKR admin" };

export default function AdminBrickrPage() {
  return (
    <Placeholder
      title="BRICKR"
      description="Service requests and the services members can book." thread="BRICKR"
      phase="Phase 9"
      items={[
        "Request board",
        "Services with tags and banners"
      ]}
    />
  );
}
