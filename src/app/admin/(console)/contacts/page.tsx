import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { loadPeople } from "@/lib/contacts/queries";
import { ContactsBoard } from "./contacts-board";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin("contacts.view");
  const [{ contacts }, base] = await Promise.all([loadPeople(), currentAdminBase()]);
  const { q } = await searchParams;
  return (
    <>
      <PageHeader title="Contacts" description="Everyone who joined, booked, applied or was added by the partners." />
      <ContactsBoard contacts={contacts} base={base} canManage={can(admin, "contacts.manage")} initialQuery={(q ?? "").slice(0, 80)} />
    </>
  );
}
