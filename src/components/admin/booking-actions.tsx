"use client";

import { useState, useTransition } from "react";
import { cancelBooking, markPaid } from "@/app/admin/(console)/outloud/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { formatEGP, type BookingStatus } from "@/lib/events/format";

/** Mark paid / cancel / refund buttons for one booking, each confirmed in a pop-up. */
export function BookingActions({ id, status, expired, name, amount, reference }: { id: string; status: BookingStatus; expired: boolean; name: string; amount: number; reference: string }) {
  const [ask, setAsk] = useState<null | "paid" | "cancel" | "refund">(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const go = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.message ?? "Done" : r.error ?? "Something went wrong");
      if (r.ok) setAsk(null);
    });

  const canPay = status === "reserved" || status === "expired";
  const canCancel = status === "reserved" && !expired;
  const canRefund = status === "confirmed";
  if (!canPay && !canCancel && !canRefund) return null;

  const copy = {
    paid: { title: "Mark as paid?", body: <>Confirm you received <b>{formatEGP(amount)}</b> from <b>{name}</b> with reference <b>{reference}</b>. {expired ? "This reservation had expired; it will be confirmed only if the seats are still free. " : ""}The member gets a confirmation email.</>, cta: "Mark as paid", variant: "primary" as const, fn: () => markPaid(id) },
    cancel: { title: "Cancel this reservation?", body: <>The seats held for <b>{name}</b> will be released.</>, cta: "Cancel reservation", variant: "danger" as const, fn: () => cancelBooking(id, false) },
    refund: { title: "Cancel and refund?", body: <>This cancels <b>{name}</b>&apos;s paid booking and records a refund of <b>{formatEGP(amount)}</b>. Send the money back by bank transfer yourself.</>, cta: "Cancel and refund", variant: "danger" as const, fn: () => cancelBooking(id, true) },
  };
  const c = ask ? copy[ask] : null;

  return (
    <div className="flex justify-end gap-1">
      {canPay ? <Button size="sm" onClick={() => setAsk("paid")}>Mark paid</Button> : null}
      {canCancel ? <Button size="sm" variant="ghost" onClick={() => setAsk("cancel")}>Cancel</Button> : null}
      {canRefund ? <Button size="sm" variant="ghost" onClick={() => setAsk("refund")}>Refund</Button> : null}
      <Modal
        open={c !== null}
        onClose={() => setAsk(null)}
        title={c?.title ?? ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsk(null)}>Back</Button>
            {c ? <Button variant={c.variant} disabled={pending} onClick={() => go(c.fn)}>{pending ? "Working…" : c.cta}</Button> : null}
          </>
        }
      >
        <p className="text-[13.5px]">{c?.body}</p>
      </Modal>
    </div>
  );
}
