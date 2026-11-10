import "server-only";
import { formatDateTime } from "@/lib/events/format";
import { emailFrame, esc, sendEmail } from "./send";

/** Sent to an admin every time their admin account signs in, so a sign-in they didn't make is noticed fast. */
export async function sendAdminSignInAlert(to: string, s: { username: string; ip: string | null; userAgent: string | null }) {
  const device = (s.userAgent ?? "").slice(0, 160);
  return sendEmail(
    to,
    "New sign-in to the VentureWeavers admin console",
    emailFrame("New admin sign-in", [
      `Your admin account <b>${esc(s.username)}</b> signed in on <b>${esc(formatDateTime(new Date().toISOString()))}</b> (Cairo time).`,
      `IP address: <b>${esc(s.ip ?? "unknown")}</b>${device ? `<br>Browser: ${esc(device)}` : ""}`,
      "If this was you, there's nothing to do. If it wasn't, change your password right away and tell your partner.",
    ]),
  );
}
