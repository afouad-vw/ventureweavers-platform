import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, MessageSquare, Radio, Ticket, Users, Video } from "lucide-react";
import { BookButton } from "@/components/events/book-button";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { namesOf } from "@/lib/details";
import { formatDateTime, formatEGP, formatTime, typeLabel } from "@/lib/events/format";
import { myActiveEventIds, paymentInstructions, type EventWithSeats } from "@/lib/events/queries";
import { loadLiveState } from "@/lib/live/queries";
import { BrochureLink, Bullets, DetailsText, Facts, Outline, outlineSummary, People, Section } from "./blocks";
import { Gallery } from "./gallery";

const cairoDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Cairo" });

/** Details page for a show, event or masterclass. */
export async function EventDetails({ e }: { e: EventWithSeats }) {
  const mc = e.type === "masterclass";
  const show = !mc && e.type !== "private_session";
  const member = await getMember();
  const [booked, pay, live] = await Promise.all([
    member ? myActiveEventIds() : Promise.resolve(new Set<string>()),
    member ? paymentInstructions() : Promise.resolve({ bank_details: "", refund_policy: "" }),
    member && show ? loadLiveState(e.id) : Promise.resolve(null),
  ]);
  const past = e.starts_at ? new Date(e.ends_at ?? e.starts_at) < new Date() : false;
  const hosts = e.host_list?.length ? e.host_list : e.hosts ? [{ name: e.hosts, title: "" }] : [];
  const guests = e.guest_list?.length ? e.guest_list : e.guest ? [{ name: e.guest, title: "" }] : [];
  const when = e.starts_at
    ? `${formatDateTime(e.starts_at)}${e.ends_at ? (cairoDay(e.starts_at) === cairoDay(e.ends_at) ? `–${formatTime(e.ends_at)}` : ` – ${formatDateTime(e.ends_at)}`) : ""}`
    : "Scheduled with you";
  const place = e.format === "Online" ? "Online (Google Meet)" : e.venue || "Location TBA";
  const details = e.details || e.description || "";

  return (
    <>
      <Link href={mc ? "/tvs?tab=masterclasses" : "/outloud"} className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        {mc ? "Masterclasses" : "Shows & events"}
      </Link>
      <Card as="article" className="vw-surface !gap-0 !p-0">
        <Banner src={e.banner_url} choice={e.banner as BannerChoice} thread={mc ? "TVS" : "Outloud"} height={240} label={e.title} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <ThreadTag thread={mc ? "TVS" : "Outloud"} />
            <span className="inline-flex h-[22px] items-center rounded-full bg-hover px-2.5 text-[11.5px] font-bold text-muted">{typeLabel(e.type)}</span>
            {e.format ? <span className="inline-flex h-[22px] items-center rounded-full bg-hover px-2.5 text-[11.5px] font-bold text-muted">{e.format}</span> : null}
          </div>
          <h1 className="font-display text-[24px] font-semibold desk:text-[28px]">{e.title}</h1>
          {e.short_description ? <p className="max-w-[70ch] text-[14.5px] text-muted">{e.short_description}</p> : null}
          <Facts
            items={[
              { icon: <CalendarDays size={16} aria-hidden="true" />, text: when },
              { icon: e.format === "Online" ? <Video size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />, text: place },
              ...(e.type !== "private_session"
                ? [
                    { icon: <Ticket size={16} aria-hidden="true" />, text: `${formatEGP(e.price_piasters)} per seat` },
                    { icon: <Users size={16} aria-hidden="true" />, text: `${e.seats_left} of ${e.capacity} seats left` },
                  ]
                : []),
            ]}
          />
          {hosts.length ? <p className="text-[13px] text-faint">Hosted by {namesOf(hosts)}{guests.length ? ` · With ${namesOf(guests)}` : ""}</p> : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            {e.type === "private_session" ? (
              <a href="mailto:info@ventureweavers.com?subject=Open%20Floor%20private%20session" className={buttonClass("primary")}>Request a session</a>
            ) : past ? (
              <span className="text-[13px] font-bold text-faint">This {mc ? "masterclass" : "event"} has passed.</span>
            ) : (
              <BookButton event={e} signedIn={!!member} booked={booked.has(e.id)} bankDetails={pay.bank_details} />
            )}
            {e.brochure_url ? <BrochureLink url={e.brochure_url} /> : null}
            {e.type !== "private_session" ? <span className="text-[12.5px] text-faint">Cancellations and refunds: {pay.refund_policy || "[REFUND POLICY]"}</span> : null}
          </div>
        </div>
      </Card>

      {show ? <LiveModeCard eventId={e.id} signedIn={!!member} state={live} past={past} /> : null}

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          {details ? <Section title={mc ? "About this masterclass" : "About this show"}><DetailsText source={details} /></Section> : null}
          {e.outline?.length ? <Section title="Outline" aside={<span className="font-normal text-faint">{outlineSummary(e.outline)}</span>}><Outline sessions={e.outline} /></Section> : null}
          {e.activities?.length ? <Section title="Activities"><Bullets items={e.activities} /></Section> : null}
          {e.gallery?.length ? <Section title="Photos" aside={<span className="font-normal text-faint">{e.gallery.length}</span>}><Gallery photos={e.gallery} title={e.title} /></Section> : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {e.audience ? <Section title="Who it's for"><p className="text-[13.5px] text-muted">{e.audience}</p></Section> : null}
          {e.prerequisites?.length ? <Section title="Pre-requisites"><Bullets items={e.prerequisites} /></Section> : null}
          {hosts.length ? <Section title={hosts.length === 1 ? "Host" : "Hosts"}><People people={hosts} /></Section> : null}
          {guests.length ? <Section title={guests.length === 1 ? "Guest" : "Guests"}><People people={guests} /></Section> : null}
        </aside>
      </div>
    </>
  );
}

/** Where ticket holders ask questions, vote and give feedback during and after the show. */
function LiveModeCard({ eventId, signedIn, state, past }: { eventId: string; signedIn: boolean; state: Awaited<ReturnType<typeof loadLiveState>>; past: boolean }) {
  const open = state?.open === true;
  const ended = !open && state !== null && (state.ended || past);
  return (
    <Card tone="ink" className="gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Radio size={18} className="text-teal" aria-hidden="true" />
        <h2 className="text-[15px] font-bold text-white">Live mode</h2>
        {open ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-teal px-2.5 text-[11px] font-extrabold tracking-[1px] text-ink">
            <i className="live-dot h-[7px] w-[7px] rounded-full bg-ink" aria-hidden="true" />
            LIVE
          </span>
        ) : null}
      </div>
      <p className="text-[13.5px]">
        {open
          ? "The show is live. Ask the floor a question, vote in the poll and upvote the questions you want answered."
          : ended
            ? "Thanks for coming. Tell us what the next show should be about."
            : state
              ? "During the show you'll ask questions, vote in polls and give feedback here. It opens when doors open."
              : signedIn
                ? "During the show, ticket holders ask questions, vote in polls and give feedback from their phones."
                : "During the show, ticket holders ask questions, vote in polls and give feedback from their phones. Sign in and book a seat to take part."}
      </p>
      {open ? (
        <LinkButton href={`/live?event=${eventId}`} variant="teal" className="self-start">
          <MessageSquare size={15} aria-hidden="true" />
          Open live mode
        </LinkButton>
      ) : ended ? (
        <LinkButton href={`/live?event=${eventId}`} variant="teal" className="self-start">Give feedback</LinkButton>
      ) : null}
    </Card>
  );
}
