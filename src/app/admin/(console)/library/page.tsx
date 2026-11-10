import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/guards";
import { adminLibrary } from "@/lib/content/admin-queries";
import { LibraryManager } from "./library-manager";

export const metadata: Metadata = { title: "Library admin" };

export default async function AdminLibraryPage() {
  await requireAdmin();
  const items = await adminLibrary();
  return (
    <>
      <PageHeader title="Library" description="Reports, guides, templates and AI skills, with who can open each one." />
      <LibraryManager items={items} />
    </>
  );
}
