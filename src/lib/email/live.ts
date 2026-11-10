import "server-only";
import { unsubscribeUrl } from "@/lib/content/unsubscribe";
import { emailFrame, esc, sendBatch } from "./send";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;

/** After the show: ask attendees what the next show should be about. */
export async function sendShowFeedback(recipients: { id: string; email: string }[], show: { id: string; title: string }) {
  if (!recipients.length || !process.env.RESEND_API_KEY) return { sent: 0, failed: 0 };
  const link = `${APP}/live?event=${show.id}`;
  return sendBatch(
    recipients.map((m) => {
      const unsub = unsubscribeUrl(APP, m.id);
      return {
        to: m.email,
        subject: `Thanks for coming to ${show.title}`,
        html: emailFrame(
          "Thanks for coming",
          [`Thank you for being part of <b>${esc(show.title)}</b>.`, "What should the next show be about? Tell us in one line. We read every one."],
          { label: "Send feedback", href: link },
          `You get this because you chose The Floor Notes and booked this show. <a href="${esc(unsub)}" style="color:#6b7a78">Unsubscribe</a>`,
        ),
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    }),
  ).catch(() => ({ sent: 0, failed: recipients.length }));
}
