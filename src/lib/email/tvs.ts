import "server-only";
import { formatEGP } from "@/lib/events/format";
import { emailFrame, esc, sendEmail } from "./send";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
const learning = { label: "Open My learning", href: `${APP}/my-space?tab=learning` };

export function sendApplicationReceived(to: string, program: string) {
  return sendEmail(
    to,
    `We got your ${program} application`,
    emailFrame("Application received", [
      `Thanks for applying to <b>${esc(program)}</b>. Fouad &amp; Karim read every application.`,
      "Next is a short intro call so the cohort fits you. We'll be in touch to set a time.",
    ], learning),
  );
}

export function sendSeatOffered(to: string, o: { program: string; cohort: string; amount_piasters: number; pay_reference: string }) {
  const lines =
    o.amount_piasters === 0
      ? [`You're in: your seat in <b>${esc(o.program)} · ${esc(o.cohort)}</b> is confirmed.`, "We'll share the start date and the classroom with you before the first session."]
      : [
          `We'd like you in <b>${esc(o.program)} · ${esc(o.cohort)}</b>.`,
          `To confirm your seat, transfer <b>${formatEGP(o.amount_piasters)}</b> by bank transfer with the reference <b>${esc(o.pay_reference)}</b>. The bank details are in My space › My learning.`,
          "We'll email you as soon as the payment is confirmed.",
        ];
  return sendEmail(to, o.amount_piasters === 0 ? `You're in: ${o.program}` : `Your seat in ${o.program}`, emailFrame(o.amount_piasters === 0 ? "You're in" : "Your seat is waiting", lines, learning));
}

export function sendEnrolmentConfirmed(to: string, o: { program: string; cohort: string }) {
  return sendEmail(
    to,
    `Payment received: ${o.program}`,
    emailFrame("You're enrolled", [
      `Thank you. Your seat in <b>${esc(o.program)} · ${esc(o.cohort)}</b> is confirmed.`,
      "We'll share the start date and open the classroom before the first session.",
    ], learning),
  );
}

export function sendClassroomReminder(to: string, items: { kind: "assignment" | "session"; title: string; when: string; meet?: string | null }[]) {
  const lines = items.map((i) =>
    i.kind === "assignment"
      ? `Assignment due: <b>${esc(i.title)}</b>, ${esc(i.when)}.`
      : `Live session: <b>${esc(i.title)}</b>, ${esc(i.when)}${i.meet ? ` · <a href="${esc(i.meet)}" style="color:#02686F">Join on Google Meet</a>` : ""}.`,
  );
  return sendEmail(to, items.length === 1 ? (items[0].kind === "assignment" ? `Due soon: ${items[0].title}` : `Tomorrow: ${items[0].title}`) : "Coming up in your classroom", emailFrame("Coming up in your classroom", lines, { label: "Open the classroom", href: `${APP}/tvs/classroom` }));
}
