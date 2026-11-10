import "server-only";
import { formatDate, formatEGP } from "@/lib/events/format";
import { emailFrame, esc, sendEmail } from "./send";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
type Req = { item: string; amount_piasters: number; reference: string; due_on: string | null; note: string };

export async function sendPaymentRequest(to: string, r: Req, bankDetails: string) {
  const lines = [
    `Here is the payment request for <b>${esc(r.item)}</b>: <b>${formatEGP(r.amount_piasters)}</b>${r.due_on ? `, due by <b>${esc(formatDate(r.due_on))}</b>` : ""}.`,
    ...(r.note ? [esc(r.note).replace(/\n/g, "<br>")] : []),
    `Pay by bank transfer and use the reference <b>${esc(r.reference)}</b> so we can match it.`,
    bankDetails ? esc(bankDetails).replace(/\n/g, "<br>") : "[BANK DETAILS]",
    "We'll email you a receipt once the transfer arrives.",
  ];
  return sendEmail(to, `Payment request: ${r.item}`, emailFrame("Payment request", lines, { label: "Open My space", href: `${APP}/my-space?tab=payments` }));
}

export async function sendPaymentReceipt(to: string, r: Req) {
  return sendEmail(
    to,
    `Payment received: ${r.item}`,
    emailFrame(
      "Payment received",
      [`Thank you. We received <b>${formatEGP(r.amount_piasters)}</b> for <b>${esc(r.item)}</b>.`, `Reference <b>${esc(r.reference)}</b>.`],
      { label: "See my payments", href: `${APP}/my-space?tab=payments` },
    ),
  );
}
