import type { Metadata } from "next";
import { WeaveHero } from "@/components/ui/weave";
import Link from "next/link";
import { BookOpen, CalendarDays, GraduationCap } from "lucide-react";
import { BookButton } from "@/components/events/book-button";
import { MeetingButton } from "@/components/brickr/meeting-button";
import { CustomProgramButton } from "@/components/tvs/custom-program";
import { customProgramService } from "@/lib/brickr/queries";
import { calendlyUrl } from "@/lib/calendly-server";
import { ProgramCta } from "@/components/tvs/program-cta";
import { type BannerChoice } from "@/components/ui/banner";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip-link";
import { ContentCard } from "@/components/ui/content-card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { myHomeProfile } from "@/lib/content/queries";
import { formatDate, formatEGP, formatTime, MASTERCLASS_FORMATS } from "@/lib/events/format";
import { listUpcomingEvents, myActiveEventIds, paymentInstructions } from "@/lib/events/queries";
import { listPrograms, myTvs, publicCohorts } from "@/lib/tvs/queries";

export const metadata: Metadata = { title: "The Venture School" };

export default async function TvsPage({ searchParams }: { searchParams: Promise<{ tab?: string; format?: string }> }) {
  const { tab: raw, format } = await searchParams;
  const tab = raw === "masterclasses" ? "masterclasses" : "programs";
  const member = await getMember();
  const [programs, classes, mine] = await Promise.all([listPrograms(), listUpcomingEvents("masterclasses"), myTvs()]);
  const enrolled = mine.enrolments.some((e) => e.status === "confirmed");

  return (
    <>
      <WeaveHero
        id="tvs-weave"
        title="The Venture School"
        above={<ThreadTag thread="TVS" />}
        description="Learn it in practice. Lead it in motion. Programs and masterclasses built from real ventures."
        actions={
          <>
            <LinkButton href="/my-space?tab=learning" variant="secondary">
              <BookOpen size={15} aria-hidden="true" />
              My learning
            </LinkButton>
            {enrolled ? (
              <LinkButton href="/tvs/classroom">
                <GraduationCap size={15} aria-hidden="true" />
                Open classroom
              </LinkButton>
            ) : null}
          </>
        }
      />
      <LinkTabs
        label="TVS sections"
        value={tab}
        hrefFor={(v) => (v === "programs" ? "/tvs" : `/tvs?tab=${v}`)}
        items={[
          { value: "programs", label: "Programs", count: programs.length },
          { value: "masterclasses", label: "Masterclasses", count: classes.length },
        ]}
      />
      {tab === "programs" ? <Programs programs={programs} mine={mine} signedIn={!!member} memberId={member?.id ?? null} /> : <Masterclasses classes={classes} format={format} signedIn={!!member} />}
    </>
  );
}

async function Programs({
  programs,
  mine,
  signedIn,
  memberId,
}: {
  programs: Awaited<ReturnType<typeof listPrograms>>;
  mine: Awaited<ReturnType<typeof myTvs>>;
  signedIn: boolean;
  memberId: string | null;
}) {
  const [profile, cohorts, me, calUrl, customService] = await Promise.all([
    memberId ? myHomeProfile(memberId) : null,
    publicCohorts(programs.map((p) => p.id)),
    getMember(),
    calendlyUrl(),
    customProgramService(),
  ]);

  return (
    <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
      {programs.length ? (
        <div className="grid min-w-0 content-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {programs.map((p) => {
            const foundation = p.kind === "Foundation";
            const next = cohorts.get(p.id)?.[0];
            const meta = p.status === "in_development"
              ? "In development"
              : next
                ? `${next.starts_on ? formatDate(`${next.starts_on}T12:00:00Z`) : "[DATE]"} · ${next.format ?? "Format TBA"} · ${formatEGP(next.price_piasters)}`
                : `${p.weeks} weeks · next cohort [DATE]`;
            return (
              <ContentCard
                key={p.id}
                thread="TVS"
                banner={p.banner as BannerChoice}
                bannerSrc={p.banner_url}
                bannerLabel={p.name}
                bannerChip={p.kind}
                bannerChipRight={foundation ? "Start here" : p.status === "in_development" ? "In development" : undefined}
                title={p.name}
                subtitle={p.kind}
                description={p.short_description || p.description}
                tags={p.tags}
                tagsBefore={p.requires_tvac && !foundation ? <span className="inline-flex h-5 items-center rounded-full bg-tvs-bg px-[8px] text-[11px] font-bold text-tvs-fg">Requires TVAC</span> : undefined}
                meta={meta}
                cta={
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <LinkButton href={`/tvs/programs/${p.slug}`} size="sm" variant="secondary">View details</LinkButton>
                    <ProgramCta p={p} mine={mine} signedIn={signedIn} profile={profile} />
                  </span>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState>Programs are on the way.</EmptyState>
      )}
      <aside className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader title="How joining works" />
          <ol className="flex flex-col gap-2.5">
            {[
              ["Apply or book", "A few questions so the cohort fits."],
              ["Short intro call", "For programs only."],
              ["Pay to confirm", "By bank transfer for now; card and wallet are coming."],
              ["Enter the classroom", "Sessions, assignments and your cohort."],
            ].map(([t, d], i) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-tvs text-[11.5px] font-extrabold text-white">{i + 1}</span>
                <span className="text-[13px]"><b>{t}</b><br /><span className="text-faint">{d}</span></span>
              </li>
            ))}
          </ol>
        </Card>
        <Card tone="ink" className="gap-2.5">
          <h2 className="text-[15px] font-bold text-white">Custom programs</h2>
          <span className="text-[13.5px]">For teams, portfolios, cohorts and organisations. Tell us what you need and we&apos;ll shape a program around it.</span>
          {calUrl && customService ? (
            <MeetingButton service={customService} variant="teal" size="md" className="self-start" />
          ) : (
            <CustomProgramButton defaults={{ name: me?.name ?? "", email: me?.email ?? "" }} />
          )}
        </Card>
      </aside>
    </div>
  );
}

async function Masterclasses({ classes, format, signedIn }: { classes: Awaited<ReturnType<typeof listUpcomingEvents>>; format?: string; signedIn: boolean }) {
  const fm = (MASTERCLASS_FORMATS as readonly string[]).includes(format ?? "") ? format! : "All";
  const [booked, pay] = signedIn ? await Promise.all([myActiveEventIds(), paymentInstructions()]) : [new Set<string>(), { bank_details: "" }];
  const list = classes.filter((c) => fm === "All" || c.format === fm);
  return (
    <>
      <ChipLinks
        label="Filter by format"
        items={["All", ...MASTERCLASS_FORMATS].map((f) => ({ href: f === "All" ? "/tvs?tab=masterclasses" : `/tvs?tab=masterclasses&format=${encodeURIComponent(f)}`, label: f, on: fm === f }))}
      />
      {list.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {list.map((e) => (
            <ContentCard
              key={e.id}
              thread="TVS"
              banner={e.banner as BannerChoice}
              bannerSrc={e.banner_url}
              bannerChip={e.starts_at ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden="true" />{formatDate(e.starts_at)}</span> : undefined}
              bannerChipRight={e.format ?? undefined}
              title={e.title}
              description={e.short_description || e.description || undefined}
              meta={
                <>
                  {e.starts_at ? formatTime(e.starts_at) : ""} · {e.seats_left} seats left · {formatEGP(e.price_piasters)}
                </>
              }
              cta={
                <span className="flex flex-wrap justify-end gap-1.5">
                  <LinkButton href={`/tvs/masterclasses/${e.slug}`} size="sm" variant="secondary">View details</LinkButton>
                  {booked.has(e.id) ? (
                    <StatusPill tone="ok">Booked</StatusPill>
                  ) : (
                    <BookButton event={e} signedIn={signedIn} booked={false} bankDetails={pay.bank_details} size="sm" label="Book" />
                  )}
                </span>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState>No masterclasses in this format yet.</EmptyState>
      )}
      <p className="text-[12.5px] text-faint">
        Online masterclasses run on Google Meet; the link appears on your ticket in My space once your seat is confirmed. <Link href="/my-space?tab=tickets" className="font-bold text-link">My tickets</Link>
      </p>
    </>
  );
}
