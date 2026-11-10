import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, MapPin, Play, Radio, Ticket, Video, Wallet } from "lucide-react";
import { PostLink } from "@/components/content/feed-item";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { ThreadTag, type TagTone } from "@/components/ui/tag";
import { Tilt } from "@/components/ui/tilt";
import { cn } from "@/lib/cn";
import { isSpace, relativeWhen, type Reminder } from "@/lib/content/format";
import type { ContentItem, PostRow, Resource } from "@/lib/content/queries";
import type { Stage } from "@/lib/brickr/queries";
import { formatDate, formatDateTime, formatTime } from "@/lib/events/format";

/** A bento tile: glass card with smooth corners, rising in on load. */
export const tileClass = "glass vw-surface vw-rise relative flex min-w-0 flex-col gap-2 border p-4";

function TileHead({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-2">
      {left}
      {right ? <span className="truncate text-[12px] text-faint">{right}</span> : null}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] font-extrabold tracking-[1.5px] text-primary uppercase">{children}</span>;
}

// ---------------------------------------------------------------- next show (big)

export type ShowTile = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  venue: string | null;
  banner: string;
  banner_url: string | null;
  capacity: number;
  seats_left: number;
  mine: "confirmed" | "reserved" | null;
  live: boolean;
};

export function NextShowTile({ show }: { show: ShowTile | null }) {
  if (!show) {
    return (
      <section className={cn(tileClass, "desk:col-span-2 desk:row-span-2 items-start justify-center")}>
        <ThreadTag thread="Outloud" />
        <b className="font-display text-[20px]">No shows on the calendar yet</b>
        <span className="text-[13px] text-muted">New dates land in Outloud first.</span>
        <LinkButton href="/outloud" variant="secondary" className="mt-1">See Outloud</LinkButton>
      </section>
    );
  }
  const taken = Math.max(0, show.capacity - show.seats_left);
  const pct = show.capacity > 0 ? Math.min(100, Math.round((taken / show.capacity) * 100)) : 0;
  return (
    <Tilt className="vw-rise flex rounded-[20px] desk:col-span-2 desk:row-span-2">
      <article className="glass vw-surface relative flex flex-1 flex-col overflow-hidden border">
        <Link href={`/outloud/events/${show.slug}`} className="vw-zoom block overflow-hidden" aria-label={show.title}>
          <Banner
            thread="Outloud"
            choice={show.banner as BannerChoice}
            src={show.banner_url}
            height={220}
            label={show.title}
            chip="Outloud · Show"
            chipRight={show.mine === "confirmed" ? "Your seat" : show.mine === "reserved" ? "Payment due" : undefined}
          />
        </Link>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-muted">
            <span className="flex items-center gap-1.5"><CalendarDays size={15} aria-hidden="true" />{formatDateTime(show.starts_at)}</span>
            <span className="flex items-center gap-1.5"><MapPin size={15} aria-hidden="true" />{show.venue ?? "[VENUE]"}</span>
          </div>
          {show.capacity > 0 ? (
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Seats taken">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#02686f,#29be9c)]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[12.5px] font-bold">{show.seats_left > 0 ? `${show.seats_left} of ${show.capacity} seats left` : "Sold out"}</span>
            </div>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2">
            {show.mine ? (
              <LinkButton href="/my-space">{show.mine === "reserved" ? <Wallet size={15} aria-hidden="true" /> : <Ticket size={15} aria-hidden="true" />}{show.mine === "reserved" ? "Pay to confirm" : "Show ticket"}</LinkButton>
            ) : (
              <LinkButton href={`/outloud/events/${show.slug}`}><Ticket size={15} aria-hidden="true" />Book a seat</LinkButton>
            )}
            {show.mine === "confirmed" ? (
              show.live ? (
                <LinkButton href={`/live?event=${show.id}`} variant="teal"><Radio size={15} aria-hidden="true" />Live mode is open</LinkButton>
              ) : (
                <span className={buttonClass("secondary", "md", "pointer-events-none opacity-80")}><Radio size={15} aria-hidden="true" />Live mode opens at doors</span>
              )
            ) : (
              <LinkButton href={`/outloud/events/${show.slug}`} variant="secondary">View details</LinkButton>
            )}
          </div>
        </div>
      </article>
    </Tilt>
  );
}

// ---------------------------------------------------------------- TVS

export type LearningTile =
  | { kind: "classroom"; cohortId: string; program: string; label: string; progress: number; next: string | null; due: number }
  | { kind: "status"; program: string; text: string; href: string; cta: string }
  | { kind: "explore" };

export function LearningTileView({ t }: { t: LearningTile }) {
  if (t.kind === "classroom") {
    return (
      <section className={tileClass}>
        <TileHead left={<ThreadTag thread="TVS" />} right={t.label} />
        <div className="mt-1 flex items-center gap-4">
          <div className="vw-ring grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full" style={{ ["--p" as string]: t.progress }} role="img" aria-label={`${t.progress}% complete`}>
            <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-card"><b className="font-display text-[22px]">{t.progress}%</b></div>
          </div>
          <div className="min-w-0">
            <b className="block truncate text-[15px]">{t.program}</b>
            <span className="block text-[12.5px] text-muted">{t.next ? `Next class ${t.next}` : "Classroom open"}</span>
            {t.due ? <span className="mt-0.5 block text-[12.5px] font-bold text-soft-fg">{t.due} {t.due === 1 ? "hand-in" : "hand-ins"} due</span> : null}
          </div>
        </div>
        <LinkButton href={`/tvs/classroom?cohort=${t.cohortId}`} size="sm" variant="secondary" className="mt-auto self-start">Open classroom</LinkButton>
      </section>
    );
  }
  if (t.kind === "status") {
    return (
      <section className={tileClass}>
        <TileHead left={<ThreadTag thread="TVS" />} />
        <b className="mt-1 text-[15px]">{t.program}</b>
        <span className="text-[13px] text-muted">{t.text}</span>
        <LinkButton href={t.href} size="sm" variant="secondary" className="mt-auto self-start">{t.cta}</LinkButton>
      </section>
    );
  }
  return (
    <section className={tileClass}>
      <TileHead left={<ThreadTag thread="TVS" />} right="Start here" />
      <b className="mt-1 text-[15px]">Start with TVAC</b>
      <span className="text-[13px] text-muted">The foundation for every 360 program: how ventures are built, run and backed.</span>
      <LinkButton href="/tvs" size="sm" variant="secondary" className="mt-auto self-start">Explore programs</LinkButton>
    </section>
  );
}

// ---------------------------------------------------------------- BRICKR

export type MeetingTile =
  | { kind: "meeting"; service: string; at: string; url: string | null }
  | { kind: "request"; service: string; status: string }
  | { kind: "explore" };

export function MeetingTileView({ t }: { t: MeetingTile }) {
  if (t.kind === "meeting") {
    return (
      <section className={tileClass}>
        <TileHead left={<ThreadTag thread="BRICKR" />} right={<span className="inline-flex items-center gap-1 font-bold text-primary"><CheckCircle2 size={14} aria-hidden="true" />Confirmed</span>} />
        <b className="mt-1 text-[15px]">{t.service}</b>
        <span className="text-[13px] text-muted">{formatDateTime(t.at)} with the partners</span>
        {t.url ? (
          <a href={t.url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "mt-auto self-start")}><Video size={14} aria-hidden="true" />Join on Meet</a>
        ) : (
          <LinkButton href="/my-space?tab=requests" size="sm" variant="secondary" className="mt-auto self-start">See request</LinkButton>
        )}
      </section>
    );
  }
  if (t.kind === "request") {
    return (
      <section className={tileClass}>
        <TileHead left={<ThreadTag thread="BRICKR" />} right={t.status} />
        <b className="mt-1 text-[15px]">{t.service}</b>
        <span className="text-[13px] text-muted">We&apos;ll confirm a time with a Meet link.</span>
        <LinkButton href="/my-space?tab=requests" size="sm" variant="secondary" className="mt-auto self-start">My requests</LinkButton>
      </section>
    );
  }
  return (
    <section className={tileClass}>
      <TileHead left={<ThreadTag thread="BRICKR" />} />
      <b className="mt-1 text-[15px]">Work with the partners</b>
      <span className="text-[13px] text-muted">Fractional leadership on building and growing your venture or portfolio.</span>
      <LinkButton href="/brickr" size="sm" variant="secondary" className="mt-auto self-start">See services</LinkButton>
    </section>
  );
}

// ---------------------------------------------------------------- latest episode

export function EpisodeTile({ item, image }: { item: ContentItem | null; image: string | null }) {
  const href = item?.url ?? "/outloud?tab=content";
  const external = Boolean(item?.url);
  const inner = (
    <>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded or YouTube preview, cropped to fit
        <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
      ) : (
        <span className="vw-pattern absolute inset-0 bg-deep" aria-hidden="true" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" aria-hidden="true" />
      <span className="absolute top-3 left-3 rounded-full bg-black/35 px-2 py-0.5 text-[10.5px] font-extrabold tracking-[1.2px] text-white uppercase backdrop-blur-md">{item?.platform ?? "Outloud"}</span>
      <span className="absolute top-1/2 left-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md transition-transform group-hover:scale-110" aria-hidden="true"><Play size={20} fill="white" /></span>
      <span className="relative mt-auto block p-4 text-white">
        <small className="text-[12px] opacity-80">{item ? [item.series, item.format].filter(Boolean).join(" · ") : "Digital content"}</small>
        <b className="block text-[15px] leading-snug">{item?.title ?? "Episodes, clips and talks from the floor"}</b>
      </span>
    </>
  );
  return (
    <Tilt className="vw-rise flex min-h-[180px] rounded-[20px]">
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="vw-surface group relative flex flex-1 overflow-hidden border border-white/40 shadow-depth">{inner}</a>
      ) : (
        <Link href={href} className="vw-surface group relative flex flex-1 overflow-hidden border border-white/40 shadow-depth">{inner}</Link>
      )}
    </Tilt>
  );
}

// ---------------------------------------------------------------- QuidQuo

export function QuidQuoTile({ stages, onWaitlist }: { stages: Stage[]; onWaitlist: boolean }) {
  return (
    <section className={tileClass}>
      <TileHead left={<ThreadTag thread="QuidQuo" />} right={onWaitlist ? "You're on the waitlist" : "Building now"} />
      <b className="mt-1 text-[15px]">AI for capital formation</b>
      {stages.length ? (
        <div className="flex gap-1.5">
          {stages.slice(0, 5).map((s) => (
            <div key={s.id} className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100} aria-label={s.name}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, s.progress))}%` }} />
              </div>
              <span className="mt-1 block truncate text-[11px] text-faint">{s.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <LinkButton href="/quidquo" size="sm" variant="secondary" className="mt-auto self-start">{onWaitlist ? "Follow progress" : "Join the waitlist"}</LinkButton>
    </section>
  );
}

// ---------------------------------------------------------------- smaller tiles

export function RemindersTile({ reminders, className = "desk:col-span-2" }: { reminders: Reminder[]; className?: string }) {
  return (
    <section className={cn(tileClass, className)}>
      <TileHead left={<Label>Reminders</Label>} right={`${reminders.length} coming up`} />
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
        <span className="text-[13px] text-faint">Nothing coming up this week.</span>
      )}
    </section>
  );
}

export function MasterclassTile({ m }: { m: { slug: string; title: string; starts_at: string; seats_left: number; booked: boolean } | null }) {
  if (!m) {
    return (
      <section className={tileClass}>
        <TileHead left={<ThreadTag thread="TVS" />} right="Masterclasses" />
        <b className="mt-1 text-[15px] leading-snug">Short, practical sessions with operators</b>
        <LinkButton href="/tvs?tab=masterclasses" size="sm" variant="secondary" className="mt-auto self-start">See masterclasses</LinkButton>
      </section>
    );
  }
  return (
    <section className={tileClass}>
      <TileHead left={<ThreadTag thread="TVS" />} right={`${formatDate(m.starts_at)} · ${formatTime(m.starts_at)}`} />
      <b className="mt-1 line-clamp-2 text-[15px] leading-snug">{m.title}</b>
      <div className="mt-auto flex items-end justify-between gap-2">
        {m.booked ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary"><CheckCircle2 size={14} aria-hidden="true" />You&apos;re booked</span>
        ) : (
          <span><b className="font-display text-[26px] leading-none">{m.seats_left}</b><span className="ml-1 text-[12px] text-faint">{m.seats_left === 1 ? "seat left" : "seats left"}</span></span>
        )}
        <LinkButton href={`/tvs/masterclasses/${m.slug}`} size="sm" variant={m.booked ? "secondary" : "primary"}>{m.booked ? "Details" : "Book"}</LinkButton>
      </div>
    </section>
  );
}

export function LibraryTile({ items }: { items: Resource[] }) {
  return (
    <section className={tileClass}>
      <TileHead left={<Label>New in the Library</Label>} />
      {items.length ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((r) => (
            <li key={r.id}>
              <Link href="/library" className="flex items-center gap-2.5 hover:[&_b]:underline">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft text-primary"><FileText size={16} aria-hidden="true" /></span>
                <span className="min-w-0"><b className="block truncate text-[13.5px]">{r.title}</b><span className="text-[12px] text-faint">{r.kind} · {relativeWhen(r.created_at)}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-faint">Reports, guides and templates land here.</span>
      )}
      <Link href="/library" className="mt-auto inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">Open the Library<ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}

export function AnnouncementsTile({ posts, className = "desk:col-span-2" }: { posts: PostRow[]; className?: string }) {
  return (
    <section className={cn(tileClass, className)}>
      <TileHead left={<Label>From the house</Label>} right={`${posts.length} ${posts.length === 1 ? "announcement" : "announcements"}`} />
      <ul className="flex flex-col">
        {posts.map((a) => {
          const inner = (
            <>
              <span className="flex items-center gap-1.5">
                <ThreadTag thread={(isSpace(a.space) ? a.space : "House") as TagTone} />
                <span className="text-[12.5px] text-faint">{relativeWhen(a.published_at)}</span>
              </span>
              <span className="text-[13.5px] font-bold">{a.title}</span>
              {a.body ? <span className="line-clamp-2 text-[12.5px] text-faint">{a.body}</span> : null}
            </>
          );
          return (
            <li key={a.id} className="border-b border-line py-2.5 last:border-b-0">
              {a.link_url ? <PostLink href={a.link_url} className="flex flex-col gap-1 hover:[&>span:nth-child(2)]:underline">{inner}</PostLink> : <div className="flex flex-col gap-1">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProfileTile({ complete }: { complete: number }) {
  return (
    <section className={cn(tileClass, "bg-soft/70")}>
      <TileHead left={<Label>Your profile</Label>} right={`${complete}%`} />
      <div className="vw-ring grid h-[64px] w-[64px] place-items-center rounded-full" style={{ ["--p" as string]: complete }} role="progressbar" aria-valuenow={complete} aria-valuemin={0} aria-valuemax={100} aria-label="Profile complete">
        <div className="grid h-[50px] w-[50px] place-items-center rounded-full bg-card"><b className="font-display text-[15px]">{complete}%</b></div>
      </div>
      <span className="text-[13px] text-muted">Add your role, stage and goals so Fouad &amp; Karim come prepared when you meet.</span>
      <LinkButton href="/my-space?tab=profile" size="sm" variant="secondary" className="mt-auto self-start">Finish profile</LinkButton>
    </section>
  );
}

export function ComingUpTile({ shows }: { shows: { id: string; slug: string; title: string; starts_at: string; booked: boolean; seats_left: number }[] }) {
  return (
    <section className={tileClass}>
      <TileHead left={<Label>Coming up</Label>} />
      {shows.length ? (
        <ul className="flex flex-col">
          {shows.map((e) => (
            <li key={e.id}>
              <Link href={`/outloud/events/${e.slug}`} className="flex flex-col border-b border-line py-1.5 last:border-b-0 hover:[&_b]:underline">
                <b className="truncate text-[13.5px]">{e.title}</b>
                <span className="text-[12px] text-faint">{formatDate(e.starts_at)} · {e.booked ? "Booked" : e.seats_left > 0 ? "Seats open" : "Sold out"}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-faint">No events scheduled yet.</span>
      )}
      <Link href="/outloud" className="mt-auto inline-flex items-center gap-1 self-start text-[13px] font-bold text-link hover:underline">All events<ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}
