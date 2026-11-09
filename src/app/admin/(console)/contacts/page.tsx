import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  await requireAdmin();
  return (
    <Placeholder
      title="Contacts"
      description="Everyone who joined, booked, applied or was added by the partners."
      phase="Phase 9"
      items={[
        "Segments by space and search",
        "Contact details with consent, requests and private notes",
        "Add, edit and import contacts"
      ]}
    />
  );
}
