import "server-only";
import { emailFrame, esc, sendEmail } from "./send";

/** A password reset link sent by a partner from Contacts. The member chooses the new password. */
export async function sendPartnerPasswordReset(to: string, name: string, link: string) {
  const first = (name || "").split(" ")[0];
  return sendEmail(
    to,
    "Reset your VentureWeavers password",
    emailFrame(
      "Reset your password",
      [
        `${first ? `Hi ${esc(first)}, the` : "The"} VentureWeavers team sent you a link to choose a new password for your account.`,
        "The link works for 2 hours. If you didn't ask for this, you can ignore this email; your password stays the same.",
      ],
      { label: "Choose a new password", href: link },
    ),
  );
}
