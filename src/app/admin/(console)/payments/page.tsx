import type { Metadata } from "next";
import { BookingsTable } from "@/components/admin/bookings-table";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { StatusPill, statusTone } from "@/components/ui/tag";
import { requireAdmin } from "@/lib/auth/guards";
import { adminPendingPayments, adminRecentPayments, adminSettings } from "@/lib/events/admin-queries";
import { formatDateTime, formatEGP } from "@/lib/events/format";
import { PaymentSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Payments" };

const methodLabel: Record<string, string> = { bank_transfer: "Bank transfer", card: "Card", wallet: "Mobile wallet", fawry: "Fawry", cash: "Cash" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function PaymentsPage() {
  await requireAdmin();
  const [pending, recent, settings] = await Promise.all([adminPendingPayments(), adminRecentPayments(), adminSettings()]);
  const now = Date.now();
  const awaiting = pending.filter((b) => b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now);
  const totalAwaiting = awaiting.reduce((n, b) => n + b.amount_piasters, 0);
  const collected = recent.filter((p) => p.status === "paid").reduce((n, p) => n + (p.amount_piasters as number), 0);

  return (
    <>
      <PageHeader title="Payments" description="Bank transfers waiting to be confirmed, recent payments, and the details members see." />
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-3">
        <Card><span className="text-[12px] font-bold text-faint">Awaiting transfer</span><b className="font-display text-[22px] font-semibold">{formatEGP(totalAwaiting)}</b><span className="text-[12px] text-faint">{awaiting.length} reservations</span></Card>
        <Card><span className="text-[12px] font-bold text-faint">Collected (recent)</span><b className="font-display text-[22px] font-semibold">{formatEGP(collected)}</b></Card>
      </div>

      <Card>
        <CardHeader title="Waiting for a bank transfer" action={<span className="font-normal text-faint">Match the reference on the transfer, then mark paid</span>} />
        <BookingsTable bookings={awaiting} showEvent />
      </Card>

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Recent payments" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="border-b border-line text-[11.5px] font-extrabold tracking-wide text-faint uppercase">
                <tr><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Method</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Reference</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody>
                {recent.map((p) => {
                  const b = p.bookings as unknown as { seats: number; events: { title: string } | null } | null;
                  return (
                    <tr key={p.id as string} className="border-b border-line last:border-b-0">
                      <td className="py-2 pr-3"><b>{b?.events?.title ?? "—"}</b><span className="block text-faint">{b?.seats} seats · {formatDateTime(p.created_at as string)}</span></td>
                      <td className="py-2 pr-3">{methodLabel[p.method as string] ?? p.method}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatEGP(p.amount_piasters as number)}</td>
                      <td className="py-2 pr-3 font-display tracking-wide">{p.reference as string}</td>
                      <td className="py-2"><StatusPill tone={statusTone(cap(p.status as string))}>{cap(p.status as string)}</StatusPill></td>
                    </tr>
                  );
                })}
                {!recent.length ? <tr><td colSpan={5} className="py-8 text-center text-faint">No payments yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="What members see" />
          <PaymentSettingsForm bankDetails={settings.bank_details} refundPolicy={settings.refund_policy} />
        </Card>
      </div>
    </>
  );
}
