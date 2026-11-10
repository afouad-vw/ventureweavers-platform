import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/guards";
import { adminSettings } from "@/lib/events/admin-queries";
import { adminLedger, memberDirectory } from "@/lib/payments/queries";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PaymentsBoard, type RequestDetail } from "./payments-board";
import { PaymentSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const supabase = await createClient();
  const [rows, members, settings, { data: reqs }, { data: admins }] = await Promise.all([
    adminLedger(),
    memberDirectory(),
    adminSettings(),
    supabase.from("payment_requests").select("id, due_on, note"),
    createServiceClient().from("admin_users").select("user_id, display_name"),
  ]);
  const details = Object.fromEntries(((reqs ?? []) as RequestDetail[]).map((r) => [r.id, r]));
  const adminNames = Object.fromEntries(((admins ?? []) as { user_id: string; display_name: string }[]).map((a) => [a.user_id, a.display_name]));
  return (
    <>
      <PageHeader title="Payments" description="Tickets, programs, masterclasses and payment requests, paid by bank transfer for now (card, wallet and Fawry once Paymob is live)." />
      <PaymentsBoard initialQuery={(q ?? "").slice(0, 80)} rows={rows} members={members} details={details} admins={adminNames} />
      <Card className="max-w-[640px]">
        <CardHeader title="What members see" />
        <PaymentSettingsForm bankDetails={settings.bank_details} refundPolicy={settings.refund_policy} />
      </Card>
    </>
  );
}
