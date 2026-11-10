import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/guards";
import { CheckInScanner } from "./scanner";

export const metadata: Metadata = { title: "Door check-in" };

export default async function CheckInPage() {
  await requireAdmin(["checkin.manage", "events.manage"]);
  return (
    <>
      <PageHeader title="Door check-in" description="Scan each ticket at the door. Paid tickets check in once; anything else is flagged." />
      <CheckInScanner />
    </>
  );
}
