import { MeetingButton } from "@/components/brickr/meeting-button";
import { Card } from "@/components/ui/card";
import { getMember } from "@/lib/auth/guards";
import { tvsRequestService } from "@/lib/brickr/queries";
import { meetingButtons } from "@/lib/waitlist";
import { CustomProgramButton } from "./custom-program";

const COPY = {
  program: { slug: "custom-program", title: "Private programs", body: "For teams, portfolios, cohorts and organisations. Tell us what you need and we'll shape a program around it." },
  class: { slug: "private-class", title: "Private classes", body: "A masterclass for your team, cohort or community, on the topic you choose, online or in person." },
} as const;

/**
 * "Private programs" (Programs tab) and "Private classes" (Masterclasses tab).
 * Follows the hidden TVS service's meeting setting: Calendly when it has one, Notify me while Coming soon,
 * otherwise a short form emailed to the private-programs inbox.
 */
export async function PrivateRequestCard({ kind, className }: { kind: "program" | "class"; className?: string }) {
  const c = COPY[kind];
  const [service, me] = await Promise.all([tvsRequestService(c.slug), getMember()]);
  const buttons = service ? meetingButtons(service) : ["request"];
  return (
    <Card tone="ink" className={`gap-2.5 ${className ?? ""}`}>
      <h2 className="text-[15px] font-bold text-white">{c.title}</h2>
      <span className="text-[13.5px]">{c.body}</span>
      {service && buttons[0] !== "request" ? (
        <MeetingButton service={service} variant="teal" size="md" className="self-start" />
      ) : (
        <CustomProgramButton kind={kind} defaults={{ name: me?.name ?? "", email: me?.email ?? "" }} />
      )}
    </Card>
  );
}
