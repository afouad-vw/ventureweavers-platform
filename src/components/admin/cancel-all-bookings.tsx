"use client";

import { useState, useTransition } from "react";
import { cancelAllBookings } from "@/app/admin/(console)/outloud/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { formatEGP } from "@/lib/events/format";

/** Cancel every active booking on an event, e.g. before removing its date. Paid bookings can be marked refunded. */
export function CancelAllBookings({ eventId, active, paid, paidAmount }: { eventId: string; active: number; paid: number; paidAmount: number }) {
  const [open, setOpen] = useState(false);
  const [refund, setRefund] = useState(true);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!active) return null;
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Cancel all bookings</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel all bookings?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Back</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => start(async () => { const r = await cancelAllBookings(eventId, refund); toast(r.ok ? r.message ?? "Done" : r.error); if (r.ok) setOpen(false); })}
            >
              {pending ? "Working…" : `Cancel ${active} booking${active === 1 ? "" : "s"}`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[13.5px]">
          <p>This cancels <b>{active}</b> active booking{active === 1 ? "" : "s"} and their tickets, and releases the seats. Use it before removing the date or calling off the show. It can&apos;t be undone.</p>
          {paid ? (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-deep)]" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
              <span>Mark the <b>{paid}</b> paid booking{paid === 1 ? "" : "s"} as refunded ({formatEGP(paidAmount)}). Send the money back by bank transfer yourself.</span>
            </label>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
