import { StatusPill } from "@/components/ui/tag";
import { bookingBadge, formatDateTime, formatEGP } from "@/lib/events/format";
import type { AdminBooking } from "@/lib/events/admin-queries";
import { BookingActions } from "./booking-actions";

export function BookingsTable({ bookings, showEvent = false }: { bookings: AdminBooking[]; showEvent?: boolean }) {
  return (
    <div className="overflow-x-auto glass rounded-2xl border">
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead className="border-b border-line text-[11.5px] font-extrabold tracking-wide text-faint uppercase">
          <tr>
            <th className="px-3 py-2.5">Member</th>
            {showEvent ? <th className="px-3 py-2.5">Event</th> : null}
            <th className="px-3 py-2.5">Seats</th>
            <th className="px-3 py-2.5">Amount</th>
            <th className="px-3 py-2.5">Reference</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const badge = bookingBadge({ status: b.status, hold_expires_at: b.hold_expires_at, checked_in_at: b.checked_in_at });
            const expired = badge.label === "Expired";
            return (
              <tr key={b.id} className="border-b border-line align-top last:border-b-0">
                <td className="px-3 py-2.5">
                  <b className="block">{b.name}</b>
                  <span className="text-faint">{b.email}{b.phone ? ` · ${b.phone}` : ""}</span>
                </td>
                {showEvent ? <td className="px-3 py-2.5">{b.event?.title ?? "—"}<span className="block text-faint">{b.event?.starts_at ? formatDateTime(b.event.starts_at) : ""}</span></td> : null}
                <td className="px-3 py-2.5">{b.seats}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatEGP(b.amount_piasters)}</td>
                <td className="px-3 py-2.5 font-display tracking-wide whitespace-nowrap">
                  {b.pay_reference}
                  {b.code ? <span className="block font-sans text-[12px] tracking-normal text-faint">Ticket {b.code}</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
                  {badge.label === "Awaiting payment" && b.hold_expires_at ? <span className="mt-1 block text-[12px] text-faint">by {formatDateTime(b.hold_expires_at)}</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  <BookingActions id={b.id} status={expired ? "expired" : b.status} expired={expired} name={b.name} amount={b.amount_piasters} reference={b.pay_reference} />
                </td>
              </tr>
            );
          })}
          {!bookings.length ? <tr><td colSpan={showEvent ? 7 : 6} className="px-3 py-8 text-center text-faint">No bookings yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
