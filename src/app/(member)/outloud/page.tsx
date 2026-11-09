import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Outloud" };

export default function OutloudPage() {
  return (
    <Placeholder
      title="Outloud"
      description="Shows and events, digital content from the floor, and the blog." thread="Outloud"
      phase="Phase 3 and Phase 5"
      items={[
        "Shows & events with booking and private sessions",
        "Digital content: shorts, carousels, reels, episodes",
        "Blog with banners, tags and an article page",
        "Suggest a topic for the next show"
      ]}
    />
  );
}
