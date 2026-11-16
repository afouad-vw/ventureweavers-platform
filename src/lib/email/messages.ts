import "server-only";
import { emailFrame, esc, sendEmail } from "./send";

const ADMIN = `https://${process.env.ADMIN_HOST ?? "admin.ventureweavers.com"}`;
/** Where new member messages are announced. */
export const MESSAGES_INBOX = process.env.MESSAGES_INBOX || "info@ventureweavers.com";

/** A member wrote to the team: a new conversation, or their first message after a quiet hour. */
export function sendMessageAlert(m: { name: string; email: string | null; body: string; isNew: boolean; threadId: string }) {
  const subject = m.isNew ? `New message from ${m.name}` : `${m.name} wrote again`;
  return sendEmail(
    MESSAGES_INBOX,
    subject,
    emailFrame(
      subject,
      [
        `<b>${esc(m.name)}</b>${m.email ? ` (${esc(m.email)})` : ""} wrote to VentureWeavers in the member app:`,
        `<span style="display:block;border-left:3px solid #29BE9C;padding-left:12px;color:#334">${esc(m.body).replace(/\n/g, "<br>")}</span>`,
        "Reply from the admin console so the member sees it in the app and gets a notification.",
      ],
      { label: "Open Messages", href: `${ADMIN}/messages?t=${m.threadId}` },
    ),
  );
}
