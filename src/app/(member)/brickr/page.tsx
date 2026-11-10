import type { Metadata } from "next";
import { Briefcase, Lock } from "lucide-react";
import { RequestButton } from "@/components/brickr/brickr-client";
import { type BannerChoice } from "@/components/ui/banner";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { listServices, myRequests } from "@/lib/brickr/queries";
import { nextWorkingDays } from "@/lib/brickr/slots";

export const metadata: Metadata = { title: "BRICKR" };

export default async function BrickrPage() {
  const [member, services] = await Promise.all([getMember(), listServices()]);
  const mine = member ? await myRequests() : [];
  const open = mine.filter((r) => r.status !== "declined").length;
  const days = nextWorkingDays();
  const isClient = mine.some((r) => r.status === "won");
  const diagnostic = services.find((s) => s.slug === "growth-diagnostic") ?? services.find((s) => s.space === "BRICKR");

  return (
    <>
      <PageHeader
        above={<ThreadTag thread="BRICKR" />}
        title="BRICKR"
        description="Fractional leadership from two operators. Pick what you need and book a first conversation."
        actions={
          <LinkButton href="/my-space?tab=requests" variant="secondary">
            <Briefcase size={15} aria-hidden="true" />
            My requests
            {open ? <span className="ml-0.5 inline-flex h-[18px] items-center rounded-md bg-hover px-1.5 text-[11px] font-bold">{open}</span> : null}
          </LinkButton>
        }
      />
      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          {services.length ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
              {services.map((s) => (
                <ContentCard
                  key={s.id}
                  thread={s.space === "Outloud" ? "Outloud" : "BRICKR"}
                  banner={s.banner as BannerChoice}
                  bannerSrc={s.banner_url}
                  bannerLabel={s.name}
                  bannerChip={s.audience}
                  title={s.name}
                  description={s.description}
                  tags={s.tags}
                  meta={s.format}
                  cta={<RequestButton service={s} days={days} signedIn={!!member} />}
                />
              ))}
            </div>
          ) : (
            <EmptyState>Services are on the way.</EmptyState>
          )}
          <Card className="flex-row items-center gap-3 border-dashed">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brk-bg text-brk-fg"><Lock size={18} aria-hidden="true" /></span>
            <span className="text-[13px]">
              <b>Client space</b>
              <br />
              <span className="text-faint">
                {isClient
                  ? "You're a BRICKR client: client resources in the Library are open to you. Your action plan, files and monthly reviews come here next."
                  : "Your action plan, requirements sheet, files and monthly reviews. Opens when you become a client."}
              </span>
            </span>
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="How it works" />
            <ol className="flex flex-col gap-2.5">
              {[
                ["Request a meeting", "Pick a service, a day and a time."],
                ["We confirm", "Within 1–2 working days, by email."],
                ["Intro call", "30 minutes with both partners."],
                ["Proposal", "Scope, plan and terms, then we start."],
              ].map(([t, d], i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brk text-[11.5px] font-extrabold text-white">{i + 1}</span>
                  <span className="text-[13px]"><b>{t}</b><br /><span className="text-faint">{d}</span></span>
                </li>
              ))}
            </ol>
          </Card>
          {diagnostic ? (
            <Card tone="soft">
              <h2 className="text-[15px] font-extrabold">Not sure where to start?</h2>
              <span className="text-[13px] text-muted">Most founders start with a growth diagnostic.</span>
              <RequestButton service={diagnostic} days={days} signedIn={!!member} label="Book a diagnostic" className="self-start" />
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
