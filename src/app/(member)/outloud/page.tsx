import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { NewsletterToggle, TopicForm } from "@/components/content/member-buttons";
import { ChipLinks } from "@/components/ui/chip-link";
import { ContentCard } from "@/components/ui/content-card";
import { BLOG_CATEGORIES, CONTENT_FORMATS } from "@/lib/content/format";
import { blogPosts, contentItems, myHomeProfile } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";
import { BookButton } from "@/components/events/book-button";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { DateBox, EmptyState, Eyebrow, PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { cairoDay, formatDateTime, formatEGP, formatTime, typeLabel } from "@/lib/events/format";
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
      <PageHeader
        above={<ThreadTag thread="Outloud" />}
        title="Outloud"
        description="Shows and events, digital content from the floor, and the blog."
        actions={tab === "shows" ? <a href="#topic" className={buttonClass("secondary")}><MessageSquare size={15} aria-hidden="true" />Suggest a topic</a> : undefined}
      />
      <LinkTabs label="Outloud sections" items={TABS} value={tab} hrefFor={(v) => (v === "shows" ? "/outloud" : `/outloud?tab=${v}`)} />
      {tab === "shows" ? <Shows /> : tab === "content" ? <DigitalContent format={format} /> : <Blog category={category} />}
    </>
  );
}

async function Shows() {
  const [events, member] = await Promise.all([listUpcomingEvents(), getMember()]);
  const [booked, pay] = member ? await Promise.all([myActiveEventIds(), paymentInstructions()]) : [new Set<string>(), { bank_details: "" }];
  const shows = events.filter((e) => e.type !== "private_session");
  const privateSession = events.find((e) => e.type === "private_session");
  const next = shows[0];

  return (
    <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
      <div className="flex min-w-0 flex-col gap-4">
        {next ? (
          <Card as="article" className="overflow-hidden !p-0 !gap-0 sm:flex-row">
            <div className="relative h-[200px] shrink-0 sm:h-auto sm:w-[42%]">
              <Banner src={next.banner_url} choice={next.banner as BannerChoice} thread="Outloud" height={200} className="h-full sm:!h-full" chip={<span className="inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-0.5 text-[11.5px] font-bold"><MessageSquare size={12} aria-hidden="true" />Open Floor.</span>} />
            </div>
            <div className="flex flex-1 flex-col gap-2.5 p-4">
              <Eyebrow>Next show · {typeLabel(next.type)}</Eyebrow>
              <h2 className="font-display text-[19px] font-semibold">
                <Link href={`/outloud/events/${next.slug}`} className="hover:underline">{next.title}</Link>
              </h2>
              {next.description ? <p className="line-clamp-3 text-[13.5px] text-muted">{next.description}</p> : null}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <Kv k="When" v={next.starts_at ? formatDateTime(next.starts_at) : "To schedule"} />
                <Kv k="Where" v={next.venue ?? "[VENUE]"} />
                <Kv k="Seat" v={formatEGP(next.price_piasters)} />
                <Kv k="Seats left" v={`${next.seats_left} of ${next.capacity}`} />
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <BookButton event={next} signedIn={!!member} booked={booked.has(next.id)} bankDetails={pay.bank_details} />
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
                      {typeLabel(e.type)} · {e.starts_at ? formatTime(e.starts_at) : ""} · {e.venue ?? "[VENUE]"} · {e.seats_left} seats left
                    </span>
                  </div>
                  {booked.has(e.id) ? (
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-soft-fg"><CheckCircle2 size={14} aria-hidden="true" />Booked</span>
                  ) : (
                    <BookButton event={e} signedIn={!!member} booked={false} bankDetails={pay.bank_details} size="sm" label="Book" />
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
        {privateSession ? (
          <Card tone="ink">
            <Eyebrow className="text-teal">For teams</Eyebrow>
            <h3 className="text-[15px] font-extrabold text-white">{privateSession.title}</h3>
            {privateSession.description ? <p className="text-[13px] text-ink-muted">{privateSession.description}</p> : null}
            <a href="mailto:info@ventureweavers.com?subject=Open%20Floor%20private%20session" className={buttonClass("teal", "md", "self-start")}>
              Request a session
            </a>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Suggest a topic" />
          <TopicForm signedIn={!!member} />
        </Card>
        <Card>
          <CardHeader title="Your hosts" />
          {[
            ["Ahmed Fouad", "/images/ahmed.jpg"],
            ["Karim Hemdan", "/images/karim.jpg"],
          ].map(([n, src]) => (
            <div key={n} className="flex items-center gap-2.5">
              <Image src={src} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
              <span className="text-[13.5px]">
                <b>{n}</b>
                <br />
                <span className="text-faint">Partner</span>
              </span>
            </div>
          ))}
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

const TILE_TONES = [
  "bg-deep text-white",
  "bg-ink text-white",
  "bg-mint text-ink",
  "bg-teal text-ink",
];

async function DigitalContent({ format }: { format?: string }) {
  const fm = (CONTENT_FORMATS as readonly string[]).includes(format ?? "") ? format! : "All";
  const items = (await contentItems()).filter((c) => fm === "All" || c.format === fm);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ChipLinks
          label="Filter by format"
          items={["All", ...CONTENT_FORMATS].map((f) => ({ href: f === "All" ? "/outloud?tab=content" : `/outloud?tab=content&format=${f}`, label: f === "All" ? "All formats" : `${f}s`, on: fm === f }))}
        />
        <span className="flex-1" />
        <span className="text-[12.5px] text-faint">Follow <b>@openfloor.show</b> on Instagram, TikTok and LinkedIn</span>
      </div>
      {items.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {items.map((c, i) => {
            const soon = c.status === "scheduled" || !c.url;
            const inner = (
              <>
                <span className="text-[11px] font-extrabold tracking-[1.2px] uppercase opacity-90">{c.platform}</span>
                <small className="text-[12px] opacity-85">{c.series} · {c.format}</small>
                <b className="mt-auto text-[15px] leading-snug font-extrabold">{c.title}</b>
                <span className="text-[12px] font-bold opacity-85">{soon ? `Coming ${formatDate(c.publish_on + "T12:00:00Z")}` : formatDate(c.publish_on + "T12:00:00Z")}</span>
              </>
            );
            const cls = `flex aspect-[4/5] flex-col gap-1 rounded-xl p-3.5 ${TILE_TONES[i % 4]}`;
            return soon ? (
              <div key={c.id} className={cls}>{inner}</div>
            ) : (
              <a key={c.id} href={c.url!} target="_blank" rel="noopener noreferrer" className={`${cls} hover:brightness-110`} aria-label={`${c.title} on ${c.platform}`}>{inner}</a>
            );
          })}
        </div>
      ) : (
        <EmptyState>No content in this format yet.</EmptyState>
      )}
      <p className="text-[12.5px] text-faint">Shorts and carousels are posted after each show. Full episodes come to YouTube.</p>
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
          items={["All", ...BLOG_CATEGORIES].map((c) => ({ href: c === "All" ? "/outloud?tab=blog" : `/outloud?tab=blog&category=${encodeURIComponent(c)}`, label: c === "All" ? "All posts" : c === "Article" ? "Articles" : c, on: cat === c }))}
        />
        {posts.length ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {posts.map((b) => (
              <Link key={b.id} href={`/outloud/blog/${b.slug}`} className="flex min-w-0 rounded-xl hover:[&_h3]:underline">
                <ContentCard
                  thread="Outloud"
                  banner={b.banner as BannerChoice}
                  bannerSrc={b.banner_url}
                  bannerChip={b.category}
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
          <h2 className="text-[15px] font-extrabold">The Floor Notes</h2>
          <span className="text-[13px] text-muted">Our newsletter: what founders asked us this month, in five minutes.</span>
          <NewsletterToggle on={!!profile?.consent_newsletter} signedIn={!!member} />
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
