import { getMember } from "@/lib/auth/guards";
import { nextWorkingDays } from "@/lib/brickr/slots";
import { calendlyUrl } from "@/lib/calendly-server";
import type { ButtonProps } from "@/components/ui/button";
import { RequestButton } from "./brickr-client";
import { CalendlyButton } from "./calendly-button";

/** Request a meeting: Karim's Calendly when its link is set in admin settings, otherwise our own slot picker. */
export async function MeetingButton({
  service,
  label = "Request a meeting",
  variant = "primary",
  size = "sm",
  className,
}: {
  service: { id: string; name: string; space: string; slug: string };
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [url, me] = await Promise.all([calendlyUrl(), getMember()]);
  if (url && me) {
    return <CalendlyButton url={url} serviceId={service.id} serviceSlug={service.slug} name={me.name ?? ""} email={me.email ?? ""} label={label} variant={variant} size={size} className={className} />;
  }
  return <RequestButton service={service} days={nextWorkingDays()} signedIn={!!me} label={label} variant={variant} size={size} className={className} />;
}
