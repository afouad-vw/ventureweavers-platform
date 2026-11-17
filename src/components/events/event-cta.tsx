import { WaitlistCta } from "@/components/waitlist/waitlist-cta";
import { BookButton, type BookableEvent } from "./book-button";

/** Book a seat, or Notify me while the event is Coming soon. */
export function EventCta({ event, ...rest }: { event: BookableEvent & { status?: string } } & Omit<React.ComponentProps<typeof BookButton>, "event">) {
  if (event.status === "coming_soon") return <WaitlistCta type="event" id={event.id} size={rest.size ?? "md"} variant="primary" />;
  return <BookButton event={event} {...rest} />;
}
