import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "My space" };

export default function MySpacePage() {
  return (
    <Placeholder
      title="My space"
      description="Your tickets, learning, requests, saved items and settings."
      phase="Phase 3"
      items={[
        "Tickets with QR codes",
        "Learning",
        "Requests and their status",
        "Saved items",
        "Profile, interests, notifications and privacy"
      ]}
    />
  );
}
