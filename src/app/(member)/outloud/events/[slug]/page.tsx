import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Ticket, Users } from "lucide-react";
import { BookButton } from "@/components/events/book-button";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { formatDateTime, formatEGP, typeLabel } from "@/lib/events/format";
import { getEventBySlug, myActiveEventIds, paymentInstructions } from "@/lib/events/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  return { title: e?.title ?? "Event", description: e?.description?.slice(0, 160) ?? undefined };
}

export default async function EventPage({ params }: Props) {
  const e = await getEventBySlug((await params).slug);
  if (!e) notFound();
  const mc = e.type === "masterclass";
  const member = await getMember();
  const [booked, pay] = member ? await Promise.all([myActiveEventIds(), paymentInstructions()]) : [new Set<string>(), { bank_details: "", refund_policy: "" }];
  const past = e.starts_at ? new Date(e.starts_at) < new Date() : false;

  return (
    <>
      <Link href={mc ? "/tvs?tab=masterclasses" : "/outloud"} className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        {mc ? "Masterclasses" : "Shows & events"}
      </Link>
      <Card as="article" className="overflow-hidden !p-0 !gap-0">
        <Banner src={e.banner_url} choice={e.banner as BannerChoice} thread={mc ? "TVS" : "Outloud"} height={220} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <ThreadTag thread={mc ? "TVS" : "Outloud"} />
            <span className="inline-flex h-[22px] items-center rounded-md bg-hover px-2 text-[11.5px] font-bold text-muted">{typeLabel(e.type)}</span>
          </div>
          <h1 className="font-display text-[22px] font-semibold desk:text-[26px]">{e.title}</h1>
          <ul className="grid gap-2 text-[13.5px] sm:grid-cols-2">
            <li className="flex items-center gap-2"><CalendarDays size={16} className="text-faint" aria-hidden="true" />{e.starts_at ? formatDateTime(e.starts_at) : "Scheduled with you"}</li>
            <li className="flex items-center gap-2"><MapPin size={16} className="text-faint" aria-hidden="true" />{e.venue ?? "[VENUE]"}</li>
            {e.type !== "private_session" ? (
              <>
                <li className="flex items-center gap-2"><Ticket size={16} className="text-faint" aria-hidden="true" />{formatEGP(e.price_piasters)} per seat</li>
                <li className="flex items-center gap-2"><Users size={16} className="text-faint" aria-hidden="true" />{e.seats_left} of {e.capacity} seats left</li>
              </>
            ) : null}
          </ul>
          {e.description ? <p className="max-w-[70ch] text-[14px] whitespace-pre-line text-muted">{e.description}</p> : null}
          <p className="text-[13px] text-faint">
            Hosted by {e.hosts || "Fouad & Karim"}
            {e.guest ? ` · Guest: ${e.guest}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            {e.type === "private_session" ? (
              <a href="mailto:info@ventureweavers.com?subject=Open%20Floor%20private%20session" className={buttonClass("primary")}>Request a session</a>
            ) : past ? (
              <span className="text-[13px] font-bold text-faint">This event has passed.</span>
            ) : (
              <BookButton event={e} signedIn={!!member} booked={booked.has(e.id)} bankDetails={pay.bank_details} />
            )}
            <span className="text-[12.5px] text-faint">Cancellations and refunds: {pay.refund_policy || "[REFUND POLICY]"}</span>
          </div>
        </div>
      </Card>
    </>
  );
}
