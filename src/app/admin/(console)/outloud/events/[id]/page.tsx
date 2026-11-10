import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanLine } from "lucide-react";
import { BookingsTable } from "@/components/admin/bookings-table";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminEventWithBookings } from "@/lib/events/admin-queries";
import { bookingBadge, formatDateTime, formatEGP } from "@/lib/events/format";

export const metadata: Metadata = { title: "Bookings" };

export default async function EventBookingsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(["events.view", "tvs.view"]);
  const base = await currentAdminBase();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await adminEventWithBookings(id);
  if (!data) notFound();
  const { event, bookings } = data;
  const badges = bookings.map((b) => ({ b, label: bookingBadge({ status: b.status, hold_expires_at: b.hold_expires_at, checked_in_at: b.checked_in_at }).label }));
  const sum = (labels: string[]) => badges.filter((x) => labels.includes(x.label)).reduce((n, x) => n + x.b.seats, 0);
  const paidSeats = sum(["Confirmed", "Checked in"]);
  const collected = badges.filter((x) => ["Confirmed", "Checked in"].includes(x.label)).reduce((n, x) => n + x.b.amount_piasters, 0);

  const stats = [
    ["Paid seats", `${paidSeats} / ${event.capacity}`],
    ["Awaiting payment", String(sum(["Awaiting payment"]))],
    ["Checked in", String(sum(["Checked in"]))],
    ["Collected", formatEGP(collected)],
  ];

  return (
    <>
      <Link href={`${base}/outloud`} className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        Events
      </Link>
      <PageHeader
        title={event.title}
        description={`${event.starts_at ? formatDateTime(event.starts_at) : ""} · ${event.venue ?? "[VENUE]"} · ${formatEGP(event.price_piasters)} per seat`}
        actions={<LinkButton href={`${base}/check-in`} variant="secondary"><ScanLine size={15} aria-hidden="true" />Door check-in</LinkButton>}
      />
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        {stats.map(([k, v]) => (
          <Card key={k}>
            <span className="text-[12px] font-bold text-faint">{k}</span>
            <b className="font-display text-[22px] font-semibold">{v}</b>
          </Card>
        ))}
      </div>
      <BookingsTable bookings={bookings} />
    </>
  );
}
