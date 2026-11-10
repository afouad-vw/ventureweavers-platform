import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin, Ticket, Users, Video } from "lucide-react";
import { BrochureLink, Bullets, DetailsText, Facts, Outline, outlineSummary, People, Section } from "@/components/details/blocks";
import { ProgramCta } from "@/components/tvs/program-cta";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { myHomeProfile } from "@/lib/content/queries";
import { formatDate, formatEGP } from "@/lib/events/format";
import { getProgram, myTvs, publicCohorts, type PublicCohort } from "@/lib/tvs/queries";

type Props = { params: Promise<{ slug: string }> };
const day = (d: string | null) => (d ? formatDate(`${d}T12:00:00Z`) : "[DATE]");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProgram((await params).slug);
  return { title: p?.name ?? "Program", description: (p?.short_description || p?.description || "").slice(0, 160) || undefined };
}

export default async function ProgramPage({ params }: Props) {
  const p = await getProgram((await params).slug);
  if (!p) notFound();
  const member = await getMember();
  const [mine, cohortsBy, profile] = await Promise.all([myTvs(), publicCohorts([p.id]), member ? myHomeProfile(member.id) : null]);
  const cohorts = cohortsBy.get(p.id) ?? [];
  const next = cohorts[0];
  const foundation = p.kind === "Foundation";

  return (
    <>
      <Link href="/tvs" className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        Programs
      </Link>
      <Card as="article" className="vw-surface !gap-0 !p-0">
        <Banner src={p.banner_url} choice={p.banner as BannerChoice} thread="TVS" height={240} label={p.name} chip={p.kind} chipRight={foundation ? "Start here" : p.status === "in_development" ? "In development" : undefined} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <ThreadTag thread="TVS" />
            {p.requires_tvac && !foundation ? <span className="inline-flex h-[22px] items-center rounded-full bg-tvs-bg px-2.5 text-[11.5px] font-bold text-tvs-fg">Requires TVAC</span> : null}
            {p.tags.map((t) => <span key={t} className="inline-flex h-[22px] items-center rounded-full bg-hover px-2.5 text-[11.5px] font-bold text-muted">{t}</span>)}
          </div>
          <h1 className="font-display text-[24px] font-semibold desk:text-[28px]">{p.name}</h1>
          {p.short_description || p.description ? <p className="max-w-[70ch] text-[14.5px] text-muted">{p.short_description || p.description}</p> : null}
          <Facts
            items={[
              { icon: <Clock size={16} aria-hidden="true" />, text: `${p.weeks} weeks${p.outline.length ? ` · ${outlineSummary(p.outline)}` : ""}` },
              ...(next ? cohortFacts(next) : p.status === "in_development" ? [{ icon: <CalendarDays size={16} aria-hidden="true" />, text: "In development: ask to be notified" }] : [{ icon: <CalendarDays size={16} aria-hidden="true" />, text: "Next cohort: [DATE]" }]),
            ]}
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <ProgramCta p={p} mine={mine} signedIn={!!member} profile={profile} size="md" />
            {p.brochure_url ? <BrochureLink url={p.brochure_url} /> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          {p.details ? <Section title="About the program"><DetailsText source={p.details} /></Section> : null}
          {p.outline.length ? <Section title="Program outline" aside={<span className="font-normal text-faint">{outlineSummary(p.outline)}</span>}><Outline sessions={p.outline} /></Section> : null}
          {p.activities.length ? <Section title="Activities"><Bullets items={p.activities} /></Section> : null}
          {cohorts.length ? (
            <Section title={cohorts.length === 1 ? "Upcoming cohort" : "Upcoming cohorts"}>
              <ul className="flex flex-col">
                {cohorts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
                    <span>
                      <b className="block text-[13.5px]">{c.label}</b>
                      <span className="text-[12.5px] text-faint">{day(c.starts_on)}{c.ends_on ? ` – ${day(c.ends_on)}` : ""} · {c.format === "In person" ? c.location || "Location TBA" : c.format ?? "Format TBA"}</span>
                    </span>
                    <span className="text-right text-[12.5px]">
                      <b className="block">{formatEGP(c.price_piasters)} per seat</b>
                      <span className="text-faint">{c.seats_left == null ? "Open" : c.seats_left ? `${c.seats_left} seats left` : "Full"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {p.audience ? <Section title="Who it's for"><p className="text-[13.5px] text-muted">{p.audience}</p></Section> : null}
          {p.prerequisites.length || (p.requires_tvac && !foundation) ? <Section title="Pre-requisites"><Bullets items={[...(p.requires_tvac && !foundation ? ["Complete TVAC first"] : []), ...p.prerequisites]} /></Section> : null}
          {p.hosts.length ? <Section title={p.hosts.length === 1 ? "Host" : "Hosts"}><People people={p.hosts} /></Section> : null}
          {p.guests.length ? <Section title={p.guests.length === 1 ? "Guest" : "Guests"}><People people={p.guests} /></Section> : null}
        </aside>
      </div>
    </>
  );
}

function cohortFacts(c: PublicCohort) {
  return [
    { icon: <CalendarDays size={16} aria-hidden="true" />, text: `${c.label}: ${day(c.starts_on)}${c.ends_on ? ` – ${day(c.ends_on)}` : ""}` },
    { icon: c.format === "Online" ? <Video size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />, text: c.format === "In person" ? c.location || "Location TBA" : c.format === "Online" ? "Online (Google Meet)" : "Format TBA" },
    { icon: <Ticket size={16} aria-hidden="true" />, text: `${formatEGP(c.price_piasters)} per seat` },
    { icon: <Users size={16} aria-hidden="true" />, text: c.capacity ? `${c.seats_left} of ${c.capacity} seats left` : "Seats open" },
  ];
}
