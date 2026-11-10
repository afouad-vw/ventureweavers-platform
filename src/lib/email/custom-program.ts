import "server-only";
import type { CustomRequest } from "@/lib/tvs/custom";
import { emailFrame, esc, sendEmail } from "./send";

/** A custom program request from the TVS page, to the custom-programs inbox. Reply goes straight to the requester. */
export async function sendCustomProgramRequest(to: string, r: CustomRequest, member: boolean) {
  const row = (k: string, v: string) => (v ? `<b>${esc(k)}:</b> ${esc(v).replace(/\n/g, "<br>")}` : "");
  return sendEmail(
    to,
    `Custom program request: ${r.organisation}`,
    emailFrame(
      "Custom program request",
      [
        `${esc(r.name)}${r.role ? `, ${esc(r.role)}` : ""} at <b>${esc(r.organisation)}</b> asked about a custom program${member ? " (signed in as a member)" : ""}.`,
        [row("For", r.forWho), row("Group size", r.size), row("Format", r.format), row("Timing", r.timing)].filter(Boolean).join("<br>"),
        row("What they want to achieve", r.goals),
        row("Anything else", r.notes),
        [row("Email", r.email), row("Phone", r.phone)].filter(Boolean).join("<br>"),
        "Reply to this email to answer them directly.",
      ].filter(Boolean),
    ),
    { replyTo: r.email },
  );
}
