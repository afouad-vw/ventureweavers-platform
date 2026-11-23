import type { Metadata } from "next";
import { WeaveHero } from "@/components/ui/weave";
import Link from "next/link";
import { ContentTile } from "@/components/content/content-tile";
import { ScrollRow } from "@/components/content/scroll-row";
import { after } from "next/server";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { MeetingButton } from "@/components/brickr/meeting-button";
import { NewsletterToggle, TopicForm } from "@/components/content/member-buttons";
import { listServices } from "@/lib/brickr/queries";
import { ChipLinks } from "@/components/ui/chip-link";
import { ContentCard } from "@/components/ui/content-card";
import { BLOG_CATEGORIES, CONTENT_FORMATS, blogCategoryLabel } from "@/lib/content/format";
import { blogPosts, episodesBySeries, latestShorts, myHomeProfile } from "@/lib/content/queries";
import { syncSocial } from "@/lib/content/social-sync";
import { formatDate } from "@/lib/events/format";
import { EventCta } from "@/components/events/event-cta";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { DateBox, EmptyState, Eyebrow } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { cairoDay, formatDateTime, formatPrice, formatTime, typeLabel } from "@/lib/events/format";
import { listUpcomingEvents, myActiveEventIds, paymentInstructions } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Outloud" };

const TABS = [
  { value: "shows", label: "Shows & events" },
  { value: "content", label: "Digital content" },
  { value: "blog", label: "Blog" },
];

export default async function OutloudPage({ searchParams }: { searchParams: Promise<{ tab?: string; format?: string; category?: string }> }) {
  const { tab: raw, format, category } = await searchParams;
  const tab = TABS.some((t) => t.value === raw) ? raw! : "shows";
  return (
    <>
      <WeaveHero
        id="outloud-weave"
        above={<ThreadTag thread="Outloud" />}
        title="Outloud"
        description="Shows and events, digital content from the floor, and the blog."
        actions={tab === "shows" ? <a href="#topic" className={buttonClass("secondary")}><MessageSquare size={15} aria-hidden="true" />Suggest a topic</a> : undefined}
      />
      <LinkTabs sections label="Outloud sections" items={TABS} value={tab} hrefFor={(v) => (v === "shows" ? "/outloud" : `/outloud?tab=${v}`)} />
      {tab === "shows" ? <Shows /> : tab === "content" ? <DigitalContent format={format} /> : <Blog category={category} />}
    </>
  );
}

async function Shows() {
  const [events, member, services] = await Promise.all([listUpcomingEvents(), getMember(), listServices()]);
  const privateService = services.find((s) => s.space === "Outloud");
  const [booked, pay] = member ? await Promise.all([myActiveEventIds(), paymentInstructions()]) : [new Set<string>(), { bank_details: "" }];
  const shows = events.filter((e) => e.type !== "private_session");
  const next = shows[0];

  return (
    <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
      <div className="flex min-w-0 flex-col gap-4">
        {next ? (
          <Card as="article" className="overflow-hidden !p-0 !gap-0 sm:flex-row">
            <div className="relative h-[200px] shrink-0 sm:h-auto sm:w-[42%]">
              <Banner src={next.banner_url} choice={next.banner as BannerChoice} thread="Outloud" height={200} className="h-full sm:!h-full" chipRight={next.status === "coming_soon" ? "Coming soon" : undefined} chip={<span className="inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-0.5 text-[11.5px] font-bold"><MessageSquare size={12} aria-hidden="true" />Open Floor.</span>} />
            </div>
            <div className="flex flex-1 flex-col gap-2.5 p-4">
              <Eyebrow>{next.status === "coming_soon" ? "Coming soon" : "Next show"} · {typeLabel(next.type)}</Eyebrow>
              <h2 className="font-display text-[19px] font-semibold">
                <Link href={`/outloud/events/${next.slug}`} className="hover:underline">{next.title}</Link>
              </h2>
              {next.description ? <p className="line-clamp-3 text-[13.5px] text-muted">{next.description}</p> : null}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <Kv k="When" v={next.starts_at ? formatDateTime(next.starts_at) : "TBA"} />
                <Kv k="Where" v={next.venue ?? "Venue TBA"} />
                <Kv k="Seat" v={next.status === "coming_soon" ? "TBA" : formatPrice(next.price_piasters)} />
                <Kv k="Seats left" v={next.status === "coming_soon" ? "TBA" : `${next.seats_left} of ${next.capacity}`} />
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <EventCta event={next} signedIn={!!member} booked={booked.has(next.id)} bankDetails={pay.bank_details} />
                <span className="text-[12.5px] text-faint">
                  Hosted by {next.hosts || "Fouad & Karim"}
                  {next.guest ? ` · Guest: ${next.guest}` : ""}
                </span>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="All upcoming" action={<span className="font-normal text-faint">Reminders by email</span>} />
          {shows.length ? (
            <ul className="flex flex-col">
              {shows.map((e) => (
                <li key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  {e.starts_at ? <DateBox date={cairoDay(e.starts_at)} /> : null}
                  <div className="min-w-0 flex-1">
                    <Link href={`/outloud/events/${e.slug}`} className="block truncate text-[14px] font-bold hover:underline">{e.title}</Link>
                    <span className="text-[12.5px] text-faint">
                      {typeLabel(e.type)} · {e.starts_at ? formatTime(e.starts_at) : "Date TBA"} · {e.venue ?? "Venue TBA"} · {e.status === "coming_soon" ? "Coming soon" : `${e.seats_left} seats left`}
                    </span>
                  </div>
                  {booked.has(e.id) ? (
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-soft-fg"><CheckCircle2 size={14} aria-hidden="true" />Booked</span>
                  ) : (
                    <EventCta event={e} signedIn={!!member} booked={false} bankDetails={pay.bank_details} size="sm" label="Book" />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No upcoming shows yet. Follow us and we&apos;ll tell you when the next one opens.</EmptyState>
          )}
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <Card tone="ink" className="gap-2.5">
          <Eyebrow className="text-teal">Private Shows &amp; Sponsorships</Eyebrow>
          <h3 className="text-[15px] font-extrabold text-white">A show for your people, or your name on ours</h3>
          <p className="text-[13px] text-ink-muted">Book a private show for your team, portfolio or community, or sponsor one of our public shows.</p>
          {privateService ? (
            <MeetingButton service={privateService} variant="teal" size="md" className="self-start" />
          ) : (
            <a href="mailto:info@ventureweavers.com?subject=Private%20show%20or%20sponsorship" className={buttonClass("teal", "md", "self-start")}>
              Get in touch
            </a>
          )}
        </Card>
        <Card>
          <CardHeader title="Suggest a topic" />
          <TopicForm signedIn={!!member} />
        </Card>
      </aside>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11.5px] text-faint">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}

const ACCOUNTS = [
  { label: "YouTube", href: "https://www.youtube.com/@Venture_Weavers" },
  { label: "Instagram", href: "https://www.instagram.com/ventureweavers" },
  { label: "TikTok", href: "https://www.tiktok.com/@ventureweavers" },
];

async function DigitalContent({ format }: { format?: string }) {
  const fm = (CONTENT_FORMATS as readonly string[]).includes(format ?? "") ? format! : "All";
  // Pull new Shorts from @ventureweavers after the page is sent, at most once an hour.
  after(() => syncSocial().catch(() => undefined));
  const [shorts, groups] = await Promise.all([fm === "Episode" ? [] : latestShorts(10), fm === "Short" ? [] : episodesBySeries()]);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ChipLinks
          label="Filter by format"
          items={["All", ...CONTENT_FORMATS].map((f) => ({ href: f === "All" ? "/outloud?tab=content" : `/outloud?tab=content&format=${f}`, label: f === "All" ? "All formats" : `${f}s`, on: fm === f }))}
        />
        <span className="flex-1" />
        <span className="text-[12.5px] text-faint">
          Follow <b>@ventureweavers</b> on{" "}
          {ACCOUNTS.map((a, i) => (
            <span key={a.label}>
              {i ? (i === ACCOUNTS.length - 1 ? " and " : ", ") : null}
              <a href={a.href} target="_blank" rel="noopener noreferrer" className="font-bold text-link hover:underline">{a.label}</a>
            </span>
          ))}
        </span>
      </div>

      {fm !== "Episode" ? (
        <section className="flex flex-col gap-3" aria-labelledby="shorts-h">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="shorts-h" className="font-display text-[18px] font-semibold">Shorts</h2>
            <span className="text-[12.5px] text-faint">The latest from @ventureweavers</span>
          </div>
          {shorts.length ? (
            <div className="grid gap-x-3 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {shorts.map((c) => <ContentTile key={c.id} c={c} />)}
            </div>
          ) : (
            <EmptyState>No Shorts yet. Stay tuned.</EmptyState>
          )}
        </section>
      ) : null}

      {fm !== "Short" ? (
        groups.length ? (
          groups.map((g) => (
            <section key={g.series.name} className="flex min-w-0 flex-col gap-3" aria-label={g.series.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <div className="flex min-w-0 flex-col">
                  <h2 className="font-display text-[18px] font-semibold">{g.series.name}</h2>
                  {g.series.description ? <p className="text-[13px] text-muted">{g.series.description}</p> : null}
                </div>
                <span className="text-[12.5px] text-faint">{g.episodes.length} episode{g.episodes.length === 1 ? "" : "s"}</span>
              </div>
              <ScrollRow label={`${g.series.name} episodes`}>
                {g.episodes.map((c) => <ContentTile key={c.id} c={c} wide />)}
              </ScrollRow>
            </section>
          ))
        ) : (
          <section className="flex flex-col gap-3" aria-labelledby="episodes-h">
            <h2 id="episodes-h" className="font-display text-[18px] font-semibold">Episodes</h2>
            <EmptyState>No episodes yet. Stay tuned.</EmptyState>
          </section>
        )
      ) : null}
    </>
  );
}

async function Blog({ category }: { category?: string }) {
  const cat = (BLOG_CATEGORIES as readonly string[]).includes(category ?? "") ? category! : "All";
  const member = await getMember();
  const [all, profile] = await Promise.all([blogPosts(), member ? myHomeProfile(member.id) : null]);
  const posts = all.filter((b) => cat === "All" || b.category === cat);
  const tags = Array.from(new Set(all.flatMap((b) => b.tags))).slice(0, 10);
  return (
    <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
      <div className="flex min-w-0 flex-col gap-3">
        <ChipLinks
          label="Filter by category"
          items={["All", ...BLOG_CATEGORIES].map((c) => ({ href: c === "All" ? "/outloud?tab=blog" : `/outloud?tab=blog&category=${encodeURIComponent(c)}`, label: c === "All" ? "All posts" : c === "Article" ? "Articles" : blogCategoryLabel(c), on: cat === c }))}
        />
        {posts.length ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {posts.map((b) => (
              <Link key={b.id} href={`/outloud/blog/${b.slug}`} className="flex min-w-0 rounded-xl hover:[&_h3]:underline">
                <ContentCard
                  thread="Outloud"
                  banner={b.banner as BannerChoice}
                  bannerSrc={b.banner_url}
                  bannerChip={blogCategoryLabel(b.category)}
                  title={b.title}
                  description={b.summary}
                  tags={b.tags}
                  meta={`${formatDate(b.published_on + "T12:00:00Z")} · ${b.read_time} read · ${b.author}`}
                  cta={<span className={buttonClass("secondary", "sm")}>Read</span>}
                />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState>No posts in this category yet.</EmptyState>
        )}
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <Card tone="soft">
          <h2 className="text-[15px] font-extrabold">VW Newsletter</h2>
          <span className="text-[13px] text-muted">Subscribe to stay up to date with VentureWeavers: new shows, programs, content and news.</span>
          <NewsletterToggle on={!!profile?.consent_newsletter} signedIn={!!member} />
        </Card>
        <Card>
          <h2 className="text-[15px] font-extrabold">Share your news</h2>
          <span className="text-[13px] text-muted">Raised a round, launched something or signed a partner? Send it to us for the VW Newsletter or VW Notes.</span>
          <Link href="/share-news" className={buttonClass("secondary", "sm") + " self-start"}>Share your news</Link>
        </Card>
        {tags.length ? (
          <Card>
            <CardHeader title="Popular tags" />
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => <span key={t} className="inline-flex h-5 items-center rounded-[5px] bg-hover px-[7px] text-[11px] font-bold text-muted">{t}</span>)}
            </div>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
