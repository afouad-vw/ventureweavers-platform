import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Outloud admin" };

export default async function AdminOutloudPage() {
  await requireAdmin();
  return (
    <Placeholder
      title="Outloud"
      description="Events, digital content, the blog and live control." thread="Outloud"
      phase="Phase 9"
      items={[
        "Events with seats and status",
        "Digital content",
        "Blog posts with tags and banners",
        "Live control: check-in, question queue, The Pick, polls"
      ]}
    />
  );
}
