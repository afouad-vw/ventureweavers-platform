import { getMember } from "@/lib/auth/guards";
import { nextWorkingDays } from "@/lib/brickr/slots";
import { meetingButtons, type BookingMode } from "@/lib/waitlist";
import type { ButtonProps } from "@/components/ui/button";
import { WaitlistCta } from "@/components/waitlist/waitlist-cta";
import { RequestButton } from "./brickr-client";
import { CalendlyButton } from "./calendly-button";

/**
 * How a member meets us for a service, as set on the service in admin:
 * a meeting request (preferred slot), booking from the service's Calendly, or both side by side.
 * While the service is Coming soon it shows Notify me instead.
 */
export async function MeetingButton({
  service,
  label = "Request a meeting",
  variant = "primary",
  size = "sm",
  className,
}: {
  service: { id: string; name: string; space: string; slug: string; status?: string; booking?: BookingMode; calendly_url?: string | null };
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const buttons = meetingButtons({ status: service.status ?? "published", booking: service.booking, calendly_url: service.calendly_url });
  if (buttons[0] === "notify") return <WaitlistCta type="service" id={service.id} size={size} variant={variant} className={className} />;
  const me = await getMember();
  const request = (l: string, v: ButtonProps["variant"]) => <RequestButton service={service} days={nextWorkingDays()} signedIn={!!me} label={l} variant={v} size={size} className={className} />;
  const calendar = (l: string) =>
    me ? (
      <CalendlyButton url={service.calendly_url!} serviceId={service.id} serviceSlug={service.slug} name={me.name ?? ""} email={me.email ?? ""} label={l} variant={variant} size={size} className={className} />
    ) : (
      request(l, variant)
    );
  if (buttons.length === 2) {
    return (
      <span className="inline-flex flex-wrap gap-2">
        {calendar("Book a time")}
        {request("Send a request", "secondary")}
      </span>
    );
  }
  return buttons[0] === "calendar" ? calendar(label) : request(label, variant);
}
