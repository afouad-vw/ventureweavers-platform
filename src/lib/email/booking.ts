import "server-only";
import { formatDateTime, formatEGP } from "@/lib/events/format";
import { emailFrame, esc, sendEmail } from "./send";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;

type Ev = { title: string; starts_at: string | null; venue: string | null };

export async function sendBookingReceived(
  to: string,
  b: { code: string; pay_reference: string; seats: number; amount_piasters: number; hold_expires_at: string | null; status: string; event: Ev },
) {
  const when = b.event.starts_at ? formatDateTime(b.event.starts_at) : "";
  const lines =
    b.status === "confirmed"
      ? [`Your ${b.seats === 1 ? "seat is" : `${b.seats} seats are`} confirmed for <b>${esc(b.event.title)}</b>${when ? `, ${esc(when)}` : ""}.`, `Your ticket code is <b>${esc(b.code)}</b>. Show the QR code in My space at the door.`]
      : [
          `We've reserved ${b.seats === 1 ? "your seat" : `${b.seats} seats`} for <b>${esc(b.event.title)}</b>${when ? `, ${esc(when)}` : ""}${b.event.venue ? ` at ${esc(b.event.venue)}` : ""}.`,
          `To confirm, transfer <b>${formatEGP(b.amount_piasters)}</b> by bank transfer${b.hold_expires_at ? ` before <b>${esc(formatDateTime(b.hold_expires_at))}</b>` : ""} and use the reference <b>${esc(b.pay_reference)}</b>. The bank details are in My space.`,
          `We'll email you when the payment is confirmed. Unpaid reservations are released after the deadline.`,
        ];
  return sendEmail(to, b.status === "confirmed" ? `You're booked: ${b.event.title}` : `Seat reserved: ${b.event.title}`, emailFrame(b.status === "confirmed" ? "You're booked" : "Your seat is reserved", lines, { label: "Open My space", href: `${APP}/my-space?tab=tickets` }));
}

export async function sendBookingConfirmed(to: string, b: { code: string; seats: number; event: Ev }) {
  const when = b.event.starts_at ? formatDateTime(b.event.starts_at) : "";
  return sendEmail(
    to,
    `Payment received: ${b.event.title}`,
    emailFrame(
      "Payment received, you're booked",
      [
        `Thank you. Your ${b.seats === 1 ? "seat is" : `${b.seats} seats are`} confirmed for <b>${esc(b.event.title)}</b>${when ? `, ${esc(when)}` : ""}${b.event.venue ? ` at ${esc(b.event.venue)}` : ""}.`,
        `Your ticket code is <b>${esc(b.code)}</b>. Show the QR code in My space at the door.`,
      ],
      { label: "Show my ticket", href: `${APP}/my-space?tab=tickets` },
    ),
  );
}

export async function sendEventReminder(to: string, b: { code: string; event: Ev }) {
  const when = b.event.starts_at ? formatDateTime(b.event.starts_at) : "";
  return sendEmail(
    to,
    `Tomorrow: ${b.event.title}`,
    emailFrame("See you tomorrow", [`<b>${esc(b.event.title)}</b> is tomorrow${when ? `, ${esc(when)}` : ""}${b.event.venue ? ` at ${esc(b.event.venue)}` : ""}.`, `Your ticket code is <b>${esc(b.code)}</b>.`], {
      label: "Show my ticket",
      href: `${APP}/my-space?tab=tickets`,
    }),
  );
}
