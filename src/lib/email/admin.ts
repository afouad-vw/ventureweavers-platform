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

/** Admin "Forgot password": a one-time link (expires in 2 hours) to choose a new password. */
export async function sendAdminPasswordReset(to: string, s: { username: string; href: string; ip: string | null }) {
  return sendEmail(
    to,
    "Reset your VentureWeavers admin password",
    emailFrame(
      "Reset your admin password",
      [
        `Someone asked to reset the password for your admin account <b>${esc(s.username)}</b> (IP address ${esc(s.ip ?? "unknown")}).`,
        "Open the link to choose a new password of at least 12 characters. It works once and expires in 2 hours.",
        "If you didn't ask for this, ignore this email; your password stays the same. Tell your partner if it keeps happening.",
      ],
      { label: "Choose a new password", href: s.href },
    ),
  );
}

/** Sent after an admin password is changed. */
export async function sendAdminPasswordChanged(to: string, s: { username: string; ip: string | null }) {
  return sendEmail(
    to,
    "Your VentureWeavers admin password was changed",
    emailFrame("Admin password changed", [
      `The password for your admin account <b>${esc(s.username)}</b> was changed on <b>${esc(formatDateTime(new Date().toISOString()))}</b> (Cairo time), from IP address <b>${esc(s.ip ?? "unknown")}</b>. Other devices were signed out.`,
      "If this wasn't you, tell your partner right away so the account can be paused.",
    ]),
  );
}
