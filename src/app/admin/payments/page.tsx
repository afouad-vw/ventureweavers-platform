import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
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
