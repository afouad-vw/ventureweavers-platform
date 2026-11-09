"use client";

import { useState, useTransition } from "react";
import { cancelMyBooking } from "@/app/(member)/outloud/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export function CancelReservation({ bookingId, title }: { bookingId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Cancel reservation
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this reservation?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Keep it</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelMyBooking(bookingId);
                  if (r.ok) {
                    setOpen(false);
                    toast("Reservation cancelled");
                  } else setError(r.error ?? "Something went wrong.");
                })
              }
            >
              {pending ? "Cancelling…" : "Cancel reservation"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px]">Your seats for <b>{title}</b> will be released for others.</p>
        {error ? <p role="alert" className="text-[13px] font-bold text-bad-fg">{error}</p> : null}
      </Modal>
    </>
  );
}
