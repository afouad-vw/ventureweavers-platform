import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "BRICKR admin" };

export default async function AdminBrickrPage() {
  await requireAdmin();
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
