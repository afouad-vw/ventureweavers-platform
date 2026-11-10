import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/guards";
import { loadPeople } from "@/lib/contacts/queries";
import { ContactsBoard } from "./contacts-board";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { contacts } = await loadPeople();
  const { q } = await searchParams;
  return (
    <>
      <PageHeader title="Contacts" description="Everyone who joined, booked, applied or was added by the partners." />
      <ContactsBoard contacts={contacts} initialQuery={(q ?? "").slice(0, 80)} />
    </>
  );
}
