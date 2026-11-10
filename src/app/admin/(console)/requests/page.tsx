import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminInbox } from "@/lib/brickr/queries";
import { RequestsInbox } from "./inbox";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  await requireAdmin();
  const [items, base] = await Promise.all([adminInbox(), currentAdminBase()]);
  return (
    <>
      <PageHeader title="Requests" description="Every meeting request, private session and application in one place." />
      <RequestsInbox items={items} spaces={["BRICKR", "Outloud", "TVS"]} base={base} />
    </>
  );
}
