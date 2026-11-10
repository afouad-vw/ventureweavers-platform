import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Users } from "lucide-react";
import { RequestButton } from "@/components/brickr/brickr-client";
import { BrochureLink, Bullets, Facts, NumberedList, Section } from "@/components/details/blocks";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { Card, CardHeader } from "@/components/ui/card";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { getService } from "@/lib/brickr/queries";
import { nextWorkingDays } from "@/lib/brickr/slots";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getService((await params).slug);
  return { title: s?.name ?? "Service", description: (s?.short_description || s?.description || "").slice(0, 160) || undefined };
}

export default async function ServicePage({ params }: Props) {
  const s = await getService((await params).slug);
  if (!s) notFound();
  const member = await getMember();
  const thread = s.space === "Outloud" ? "Outloud" : "BRICKR";
  return (
    <>
      <Link href={thread === "Outloud" ? "/outloud" : "/brickr"} className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        {thread === "Outloud" ? "Outloud" : "BRICKR services"}
      </Link>
      <Card as="article" className="vw-surface !gap-0 !p-0">
        <Banner src={s.banner_url} choice={s.banner as BannerChoice} thread={thread} height={220} label={s.name} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <ThreadTag thread={thread} />
            {s.tags.map((t) => <span key={t} className="inline-flex h-[22px] items-center rounded-full bg-hover px-2.5 text-[11.5px] font-bold text-muted">{t}</span>)}
          </div>
          <h1 className="font-display text-[24px] font-semibold desk:text-[28px]">{s.name}</h1>
          {s.short_description || s.description ? <p className="max-w-[70ch] text-[14.5px] text-muted">{s.short_description || s.description}</p> : null}
          <Facts
            items={[
              ...(s.format ? [{ icon: <Briefcase size={16} aria-hidden="true" />, text: s.format }] : []),
              ...(s.offerings.length ? [{ icon: <Users size={16} aria-hidden="true" />, text: `${s.offerings.length} offerings` }] : []),
            ]}
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <RequestButton service={s} days={nextWorkingDays()} signedIn={!!member} />
            {s.brochure_url ? <BrochureLink url={s.brochure_url} /> : null}
          </div>
        </div>
      </Card>
      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          {s.offerings.length ? <Section title="What you get"><NumberedList items={s.offerings} /></Section> : null}
          <Card>
            <CardHeader title="How it works" />
            <NumberedList items={["Pick a time that suits you (Sunday to Thursday, Cairo time).", "We confirm within 1–2 working days, with a Google Meet link.", "We meet, then agree the scope and next steps together."]} />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {s.audience ? <Section title="Who it's for"><p className="text-[13.5px] text-muted">{s.audience}</p></Section> : null}
          {s.prerequisites.length ? <Section title="Pre-requisites"><Bullets items={s.prerequisites} /></Section> : null}
        </aside>
      </div>
    </>
  );
}
