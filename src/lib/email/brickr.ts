import "server-only";
import { formatDateTime } from "@/lib/events/format";
import { createServiceClient } from "@/lib/supabase/service";
import { emailFrame, esc, sendEmail } from "./send";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
const ADMIN = `https://${process.env.ADMIN_HOST ?? "admin.ventureweavers.com"}`;
const requests = { label: "Open My requests", href: `${APP}/my-space?tab=requests` };

export function sendRequestReceived(to: string, r: { service: string; preferred_at: string }) {
  return sendEmail(
    to,
    `Request received: ${r.service}`,
    emailFrame("Request received", [
      `Thanks. We got your request for <b>${esc(r.service)}</b>, preferably ${esc(formatDateTime(r.preferred_at))} (Cairo).`,
      "We confirm within 1–2 working days, with a Google Meet link for a 30-minute intro call with both partners.",
    ], requests),
  );
}

export function sendMeetingConfirmed(to: string, r: { service: string; meeting_at: string; meeting_url: string | null }) {
  return sendEmail(
    to,
    `Confirmed: ${r.service}, ${formatDateTime(r.meeting_at)}`,
    emailFrame("Your meeting is confirmed", [
      `<b>${esc(r.service)}</b> with Fouad &amp; Karim, ${esc(formatDateTime(r.meeting_at))} (Cairo).`,
      r.meeting_url ? `Join on Google Meet: <a href="${esc(r.meeting_url)}" style="color:#02686F">${esc(r.meeting_url.replace(/^https:\/\//, ""))}</a>` : "We'll send the meeting link before the call.",
    ], requests),
  );
}

/** Email both partners (the admin accounts) about something new in the console. */
export async function alertPartners(subject: string, lines: string[], path: string) {
  if (!process.env.RESEND_API_KEY) return;
  const svc = createServiceClient();
  const { data } = await svc.from("admin_users").select("user_id");
  const ids = ((data ?? []) as { user_id: string }[]).map((x) => x.user_id);
  const emails = (await Promise.all(ids.map(async (id) => (await svc.auth.admin.getUserById(id)).data.user?.email))).filter(Boolean) as string[];
  await Promise.all(emails.map((to) => sendEmail(to, subject, emailFrame(subject, lines, { label: "Open the console", href: `${ADMIN}${path}` })).catch(() => null)));
}
