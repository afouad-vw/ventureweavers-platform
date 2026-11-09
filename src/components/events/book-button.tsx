"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import { bookEvent, type BookResult } from "@/app/(member)/outloud/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { formatDateTime, formatEGP, MAX_SEATS } from "@/lib/events/format";

export type BookableEvent = {
  id: string;
  slug: string;
  title: string;
  starts_at: string | null;
  venue: string | null;
  price_piasters: number | null;
  seats_left: number;
};

/**
 * "Book a seat" button with the booking pop-up from the prototype: choose seats, see the total,
 * reserve, then pay by bank transfer within the deadline.
 */
export function BookButton({
  event,
  signedIn,
  booked,
  bankDetails,
  size = "md",
  label = "Book a seat",
}: {
  event: BookableEvent;
  signedIn: boolean;
  booked: boolean;
  bankDetails: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(1);
  const [result, setResult] = useState<BookResult | null>(null);
  const [pending, start] = useTransition();
  const max = Math.min(MAX_SEATS, event.seats_left);

  if (booked) {
    return (
      <Link href="/my-space?tab=tickets" className={buttonClass("secondary", size)}>
        View ticket
      </Link>
    );
  }
  if (event.price_piasters == null) return <span className="text-[12.5px] font-bold text-faint">Booking opens soon</span>;
  if (event.seats_left <= 0) return <span className="text-[12.5px] font-bold text-faint">Sold out</span>;
  if (!signedIn) {
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(`/outloud/events/${event.slug}`)}`} className={buttonClass("primary", size)}>
        {label}
      </Link>
    );
  }

  const close = () => {
    setOpen(false);
    if (result?.ok) setResult(null);
  };
  const ok = result?.ok ? result : null;

  return (
    <>
      <Button size={size} onClick={() => { setResult(null); setSeats(1); setOpen(true); }}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        eyebrow={event.starts_at ? formatDateTime(event.starts_at) : undefined}
        title={ok ? (ok.status === "confirmed" ? "You're booked" : "Your seat is reserved") : event.title}
        footer={
          ok ? (
            <Link href="/my-space?tab=tickets" className={buttonClass("primary", "md", "w-full")}>
              Show my ticket
            </Link>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-[12.5px] text-faint">
                Total
                <br />
                <b className="font-display text-[15px] text-fg">{formatEGP((event.price_piasters ?? 0) * seats)}</b>
              </span>
              <Button disabled={pending} onClick={() => start(async () => setResult(await bookEvent(event.id, seats)))}>
                {pending ? "Reserving…" : event.price_piasters === 0 ? "Book" : "Reserve and pay by transfer"}
              </Button>
            </div>
          )
        }
      >
        {ok ? (
          <div className="flex flex-col gap-3 text-[13.5px]">
            <CheckCircle2 size={36} className="text-teal" aria-hidden="true" />
            {ok.status === "confirmed" ? (
              <p>Your ticket is in My space. A copy went to your email.</p>
            ) : (
              <>
                <p>
                  Transfer <b>{formatEGP(ok.amountPiasters)}</b>
                  {ok.holdExpiresAt ? (
                    <>
                      {" "}before <b>{formatDateTime(ok.holdExpiresAt)}</b>
                    </>
                  ) : null}{" "}
                  and write this reference with the transfer:
                </p>
                <code className="self-start rounded-lg bg-hover px-3 py-2 font-display text-[16px] font-bold tracking-wider">{ok.payReference}</code>
                <div className="rounded-lg border border-line bg-bg p-3 text-[13px] whitespace-pre-line">{bankDetails || "[BANK DETAILS]"}</div>
                <p className="text-faint">We&apos;ll email you once the payment is confirmed. Unpaid reservations are released after the deadline.</p>
              </>
            )}
            <p className="text-faint">
              Ticket code <b className="text-fg">{ok.code}</b>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px]">
                <b>Seats</b>
                <br />
                <span className="text-faint">
                  {formatEGP(event.price_piasters)} each · {event.seats_left} left · up to {MAX_SEATS}
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-line2 p-1">
                <button type="button" aria-label="One seat fewer" disabled={seats <= 1} onClick={() => setSeats(seats - 1)} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-hover disabled:opacity-40">
                  <Minus size={14} aria-hidden="true" />
                </button>
                <b className="min-w-4 text-center font-display" aria-live="polite">{seats}</b>
                <button type="button" aria-label="One more seat" disabled={seats >= max} onClick={() => setSeats(seats + 1)} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-hover disabled:opacity-40">
                  <Plus size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
            {event.price_piasters !== 0 ? (
              <div className="rounded-lg bg-soft p-3 text-[13px] text-soft-fg">
                <b>Pay by bank transfer.</b> We hold your seat for up to 48 hours (less if the show is sooner). You get a reference to use with the transfer.
              </div>
            ) : null}
            {result && !result.ok ? (
              <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">
                {result.error}
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
