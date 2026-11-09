import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireAdmin();
  return (
    <Placeholder
      title="Payments"
      description="Tickets, programs, masterclasses and service invoices."
      phase="Phase 4 and Phase 9"
      items={[
        "Collected, pending and refunded totals",
        "Every transaction with gateway reference",
        "Mark Fawry or bank payments as paid",
        "Refunds with confirmation, payment links, receipts, CSV export"
      ]}
    />
  );
}
