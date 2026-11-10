import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Pencil, Ticket, Wallet } from "lucide-react";
import { FeedItem, PostLink } from "@/components/content/feed-item";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip-link";
import { DateBox, EmptyState, Eyebrow, PageHeader } from "@/components/ui/misc";
import { ThreadTag, threadDot, type TagTone } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { getMember } from "@/lib/auth/guards";
import { buildReminders, filterBySpace, isSpace, profileCompletion, relativeWhen, SPACES, tunedTo } from "@/lib/content/format";
import { feedPosts, myHomeProfile, mySavedKeys } from "@/lib/content/queries";
import { cairoDay, formatDateTime, formatTime, TZ } from "@/lib/events/format";
import { listUpcomingEvents, myActiveEventIds, myBookings } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Home" };

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const { space: raw } = await searchParams;
  const space = raw && isSpace(raw) ? raw : "All";
  const member = await getMember();
  const [events, profile, bookings, booked, posts, saved] = await Promise.all([
    listUpcomingEvents(),
    member ? myHomeProfile(member.id) : null,
    member ? myBookings() : [],
    member ? myActiveEventIds() : new Set<string>(),
    member ? feedPosts() : [],
    member ? mySavedKeys() : new Set<string>(),
  ]);

  const shows = events.filter((e) => e.type !== "private_session" && e.starts_at);
  const now = Date.now();
  const nextUp = bookings
    .filter((b) => (b.status === "confirmed" || (b.status === "reserved" && b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now)) && b.events?.starts_at && new Date(b.events.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.events!.starts_at!).getTime() - new Date(b.events!.starts_at!).getTime())[0];
  const reminders = buildReminders(bookings);
  const announcements = posts.filter((p) => p.pinned_until && new Date(p.pinned_until).getTime() > now);
  const feed = filterBySpace(posts, space);
  const first = (profile?.full_name || member?.name || "").split(" ")[0];
  const tuned = tunedTo(profile);
  const complete = profileCompletion(profile);

  return (
    <>
      <PageHeader
        title={member ? `${greeting()}${first ? `, ${first}` : ""}` : "Welcome to VentureWeavers"}
        description={
          member
            ? tuned
              ? `Your feed is tuned to ${tuned}.`
              : "Tell us your role, stage and interests to tune your feed."
            : "Shows, programs and hands-on partnership for MENA's venture builders. Join to get your feed."
        }
        actions={
          member ? (
            <LinkButton href="/my-space?tab=profile" variant="secondary">
              <Pencil size={15} aria-hidden="true" />
              Edit interests
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="secondary">Sign in</LinkButton>
              <LinkButton href="/join">Join</LinkButton>
            </>
          )
        }
      />

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          {nextUp?.events?.starts_at ? (
            <Card tone="ink" className="flex-row flex-wrap items-center gap-3.5">
              <DateBox date={cairoDay(nextUp.events.starts_at)} />
              <div className="min-w-[180px] flex-1">
                <Eyebrow className="text-teal">{nextUp.status === "confirmed" ? "Next up · you're booked" : "Next up · reserved, payment due"}</Eyebrow>
                <h3 className="mt-0.5 text-[15.5px] font-extrabold text-white">{nextUp.events.title}</h3>
                <span className="text-[12.5px] text-ink-muted">{formatTime(nextUp.events.starts_at)} · {nextUp.events.venue ?? "[VENUE]"}</span>
              </div>
              <LinkButton href="/my-space" variant="teal">
                <Ticket size={15} aria-hidden="true" />
                Ticket
              </LinkButton>
            </Card>
          ) : null}

          {member ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
              <Card>
                <CardHeader title="Reminders" action={<span className="font-normal text-faint">{reminders.length} coming up</span>} />
                {reminders.length ? (
                  <ul className="flex flex-col">
                    {reminders.map((r) => {
                      const Icon = r.icon === "wallet" ? Wallet : Ticket;
                      return (
                        <li key={r.key} className="flex items-center gap-2.5 border-b border-line py-2 last:border-b-0">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soft text-soft-fg"><Icon size={16} aria-hidden="true" /></span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-bold">{r.title}</div>
                            <span className="text-[12.5px] text-faint">{r.detail}</span>
                          </div>
                          <LinkButton href={r.href} variant="secondary" size="sm">{r.cta}</LinkButton>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span className="text-[13px] text-faint">Nothing coming up.</span>
                )}
              </Card>
              <Card>
                <CardHeader title="Announcements" action={<span className="font-normal text-faint">From the house</span>} />
                {announcements.length ? (
                  <ul className="flex flex-col">
                    {announcements.map((a) => {
                      const inner = (
                        <>
                          <span className="flex items-center gap-1.5">
                            <ThreadTag thread={isSpace(a.space) ? a.space : "House"} />
                            <span className="text-[12.5px] text-faint">{relativeWhen(a.published_at)}</span>
                          </span>
                          <span className="text-[13.5px] font-bold">{a.title}</span>
                          {a.body ? <span className="line-clamp-2 text-[12.5px] text-faint">{a.body}</span> : null}
                        </>
                      );
                      return (
                        <li key={a.id} className="border-b border-line py-2.5 last:border-b-0">
                          {a.link_url ? (
                            <PostLink href={a.link_url} className="flex flex-col gap-1 hover:[&>span:nth-child(2)]:underline">{inner}</PostLink>
                          ) : (
                            <div className="flex flex-col gap-1">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span className="text-[13px] text-faint">No announcements right now.</span>
                )}
              </Card>
            </div>
          ) : null}

          <Card>
            <CardHeader title="Feed" action={member ? <span className="font-normal text-faint">{feed.length} updates</span> : null} />
            {member ? (
              <>
                <ChipLinks
                  label="Filter feed"
                  items={[{ value: "All", label: "All" }, ...SPACES.filter((s) => s.value !== "House"), SPACES[0]].map((s) => ({
                    href: s.value === "All" ? "/" : `/?space=${s.value}`,
                    label: s.label,
                    on: space === s.value,
                  }))}
                />
                {feed.length ? (
                  <div className="flex flex-col">
                    {feed.map((p) => <FeedItem key={p.id} post={p} saved={saved.has(`post:${p.id}`)} signedIn />)}
                  </div>
                ) : (
                  <EmptyState>Nothing here for this filter yet.</EmptyState>
                )}
              </>
            ) : (
              <EmptyState>
                Your feed shows updates from Outloud, TVS, BRICKR and QuidQuo.{" "}
                <Link href="/sign-in" className="font-bold text-link">Sign in</Link> or <Link href="/join" className="font-bold text-link">join</Link> to see it.
              </EmptyState>
            )}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Coming up" action={<Link href="/outloud" className="text-link">All events</Link>} />
            {shows.length ? (
              <ul className="flex flex-col">
                {shows.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <Link href={`/outloud/events/${e.slug}`} className="flex items-center gap-2.5 border-b border-line py-2 hover:[&_.t]:underline">
                      <DateBox date={cairoDay(e.starts_at!)} />
                      <div className="min-w-0 flex-1">
                        <div className="t truncate text-[13.5px] font-bold">{e.title}</div>
                        <span className="text-[12.5px] text-faint">
                          {formatTime(e.starts_at!)} · {booked.has(e.id) ? <b className="text-soft-fg">Booked</b> : e.seats_left > 0 ? "Seats open" : "Sold out"}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px] text-faint">No events scheduled yet.</span>
            )}
          </Card>

          <Card>
            <CardHeader title="Your spaces" />
            <ul className="flex flex-col">
              {(
                [
                  ["/outloud", "Outloud", "Shows, content, blog"],
                  ["/tvs", "TVS", "Programs and masterclasses"],
                  ["/brickr", "BRICKR", "Work with the partners"],
                  ["/quidquo", "QuidQuo", "Join the waitlist"],
                ] as [string, TagTone, string][]
              ).map(([href, t, sub]) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-2.5 py-2 hover:[&_.t]:underline">
                    <i className={cn("h-2 w-2 shrink-0 rounded-full", threadDot[t])} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="t text-[13.5px] font-bold">{t}</div>
                      <span className="text-[12.5px] text-faint">{sub}</span>
                    </div>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {member && complete < 100 ? (
            <Card tone="soft">
              <h2 className="text-[15px] font-extrabold">Complete your profile</h2>
              <div className="h-1.5 overflow-hidden rounded-full bg-card" role="progressbar" aria-valuenow={complete} aria-valuemin={0} aria-valuemax={100} aria-label="Profile complete">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${complete}%` }} />
              </div>
              <span className="text-[13px] text-muted">Add your role, stage and goals so Fouad &amp; Karim come prepared when you meet.</span>
              <Link href="/my-space?tab=profile" className={buttonClass("ghost", "sm", "self-start !px-0")}>Finish profile</Link>
            </Card>
          ) : null}
          {nextUp?.status === "reserved" && nextUp.hold_expires_at ? (
            <p className="text-[12.5px] text-faint">Seats for {nextUp.events?.title} are held until {formatDateTime(nextUp.hold_expires_at)}.</p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
