import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { FeedItem } from "@/components/content/feed-item";
import {
  AnnouncementsTile,
  ComingUpTile,
  EpisodeTile,
  LearningTileView,
  LibraryTile,
  MasterclassTile,
  MeetingTileView,
  NextShowTile,
  ProfileTile,
  QuidQuoTile,
  RemindersTile,
  type LearningTile,
  type MeetingTile,
  type ShowTile,
} from "@/components/home/bento";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip-link";
import { Countdown } from "@/components/ui/countdown";
import { EmptyState } from "@/components/ui/misc";
import { Stitch, Weave } from "@/components/ui/weave";
import { getMember } from "@/lib/auth/guards";
import { myRequests, myWaitlist, qqStages } from "@/lib/brickr/queries";
import { buildReminders, filterBySpace, isSpace, profileCompletion, SPACES, tunedTo, youtubeThumb } from "@/lib/content/format";
import { contentItems, feedPosts, libraryResources, myHomeProfile, mySavedKeys } from "@/lib/content/queries";
import { formatDate, formatTime, TZ } from "@/lib/events/format";
import { listUpcomingEvents, myActiveEventIds, myBookings } from "@/lib/events/queries";
import { myLiveShows } from "@/lib/live/queries";
import { assignmentState, isOpen, nextSession, overallProgress } from "@/lib/tvs/classroom";
import { loadClassroom, myClassrooms } from "@/lib/tvs/classroom-queries";
import { enrolmentLabel } from "@/lib/tvs/format";
import { myTvs } from "@/lib/tvs/queries";

export const metadata: Metadata = { title: "Home" };

const DAY = 24 * 3600 * 1000;

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** "a show, a meeting with the partners and a live class" */
function listOf(parts: string[]) {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

async function learningTile(): Promise<LearningTile> {
  const rooms = await myClassrooms().catch(() => []);
  if (rooms.length) {
    const room = await loadClassroom(rooms[0].id).catch(() => null);
    if (room) {
      const open = new Set(room.modules.filter((m) => isOpen(m)).map((m) => m.id));
      const subs = new Map(room.submissions.map((s) => [s.assignment_id, s]));
      const due = room.assignments.filter((a) => {
        const s = assignmentState(a, open.has(a.module_id), subs.get(a.id));
        return s === "Due" || s === "Overdue";
      }).length;
      const next = nextSession(room.sessions);
      return {
        kind: "classroom",
        cohortId: room.cohort.id,
        program: room.cohort.program,
        label: room.cohort.label,
        progress: overallProgress(room.steps, room.done),
        next: next ? `${formatDate(next.starts_at)} · ${formatTime(next.starts_at)}` : null,
        due,
      };
    }
  }
  const { enrolments, applications } = await myTvs().catch(() => ({ enrolments: [], applications: [], interests: new Set<string>() }));
  const offered = enrolments.find((e) => e.status === "offered");
  if (offered) return { kind: "status", program: offered.cohorts?.programs?.name ?? "Your program", text: `${enrolmentLabel(offered.status)}. Pay to confirm your seat.`, href: "/my-space?tab=learning", cta: "My learning" };
  const applied = applications.find((a) => a.status !== "declined" && a.status !== "won");
  if (applied) return { kind: "status", program: applied.programs?.name ?? "Your application", text: applied.status === "intro_call" ? "Next step: a short intro call with the partners." : "Application received. We'll be in touch.", href: "/my-space?tab=learning", cta: "My learning" };
  return { kind: "explore" };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const { space: raw } = await searchParams;
  const space = raw && isSpace(raw) ? raw : "All";
  const member = await getMember();
  const [events, profile, bookings, booked, posts, saved, learning, requests, stages, waitlist, content, library, live] = await Promise.all([
    listUpcomingEvents("all"),
    member ? myHomeProfile(member.id) : null,
    member ? myBookings() : [],
    member ? myActiveEventIds() : new Set<string>(),
    member ? feedPosts() : [],
    member ? mySavedKeys() : new Set<string>(),
    member ? learningTile() : ({ kind: "explore" } as LearningTile),
    member ? myRequests().catch(() => []) : [],
    qqStages().catch(() => []),
    member ? myWaitlist(member.id).catch(() => null) : null,
    member ? contentItems().catch(() => []) : [],
    member ? libraryResources().catch(() => []) : [],
    member ? myLiveShows().catch(() => []) : [],
  ]);
  const liveIds = new Set(live.map((l) => l.eventId));
  const now = Date.now();

  // Next show: the member's next booked show, else the next published show.
  const nextUp = bookings
    .filter((b) => (b.status === "confirmed" || (b.status === "reserved" && b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now)) && b.events?.starts_at && new Date(b.events.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.events!.starts_at!).getTime() - new Date(b.events!.starts_at!).getTime())[0];
  const shows = events.filter((e) => e.type !== "private_session" && e.type !== "masterclass" && e.starts_at);
  const showEvent = (nextUp?.events && events.find((e) => e.id === nextUp.events!.id)) || shows[0] || null;
  const show: ShowTile | null = showEvent?.starts_at
    ? {
        id: showEvent.id,
        slug: showEvent.slug,
        title: showEvent.title,
        starts_at: showEvent.starts_at,
        venue: showEvent.venue,
        banner: showEvent.banner,
        banner_url: showEvent.banner_url,
        capacity: showEvent.capacity,
        seats_left: showEvent.seats_left,
        mine: nextUp?.events?.id === showEvent.id ? (nextUp.status as "confirmed" | "reserved") : null,
        live: liveIds.has(showEvent.id),
      }
    : null;

  const mc = events.find((e) => e.type === "masterclass" && e.starts_at);
  const masterclass = mc ? { slug: mc.slug, title: mc.title, starts_at: mc.starts_at!, seats_left: mc.seats_left, booked: booked.has(mc.id) } : null;

  const confirmedMeeting = requests
    .filter((r) => r.meeting_at && new Date(r.meeting_at).getTime() + 3600 * 1000 > now && r.status !== "declined")
    .sort((a, b) => a.meeting_at!.localeCompare(b.meeting_at!))[0];
  const openRequest = requests.find((r) => !r.meeting_at && (r.status === "new" || r.status === "intro_call" || r.status === "proposal"));
  const meeting: MeetingTile = confirmedMeeting
    ? { kind: "meeting", service: confirmedMeeting.services?.name ?? "Meeting with the partners", at: confirmedMeeting.meeting_at!, url: confirmedMeeting.meeting_url }
    : openRequest
      ? { kind: "request", service: openRequest.services?.name ?? "Your request", status: openRequest.status === "new" ? "Received" : openRequest.status === "intro_call" ? "Intro call" : "Proposal" }
      : { kind: "explore" };

  const episode = content.find((c) => c.status === "published" && c.url) ?? content.find((c) => c.status === "published") ?? null;
  const episodeImage = episode ? episode.image_url || youtubeThumb(episode.url) : null;

  const reminders = buildReminders(bookings);
  const announcements = posts.filter((p) => p.pinned_until && new Date(p.pinned_until).getTime() > now);
  const feed = filterBySpace(posts, space);
  const first = (profile?.full_name || member?.name || "").split(" ")[0];
  const tuned = tunedTo(profile);
  const complete = profileCompletion(profile);

  // One line about the week ahead.
  const week: string[] = [];
  if (show?.mine && new Date(show.starts_at).getTime() - now < 7 * DAY) week.push("a show");
  if (masterclass?.booked && new Date(masterclass.starts_at).getTime() - now < 7 * DAY) week.push("a masterclass");
  if (confirmedMeeting && new Date(confirmedMeeting.meeting_at!).getTime() - now < 7 * DAY) week.push("a meeting with the partners");
  if (learning.kind === "classroom" && learning.next) week.push("a live class");
  const line = week.length
    ? `This week: ${listOf(week)}.`
    : tuned
      ? `Your feed is tuned to ${tuned}.`
      : "Tell us your role, stage and interests to tune your feed.";

  // Bento rows of four: one wide tile and two small ones per row, so the grid never leaves a gap on desktop.
  const wide1 = reminders.length ? <RemindersTile reminders={reminders} /> : announcements.length ? <AnnouncementsTile posts={announcements} /> : <RemindersTile reminders={[]} />;
  const wide2 = reminders.length > 0 && announcements.length > 0;
  const comingUp = shows.filter((e) => e.id !== show?.id).slice(0, 3).map((e) => ({ id: e.id, slug: e.slug, title: e.title, starts_at: e.starts_at!, booked: booked.has(e.id), seats_left: e.seats_left }));
  const pool = [
    <MasterclassTile key="mc" m={masterclass} />,
    complete < 100 ? <ProfileTile key="profile" complete={complete} /> : null,
    <LibraryTile key="library" items={library.slice(0, 2)} />,
    <ComingUpTile key="coming" shows={comingUp} />,
  ].filter(Boolean);

  return (
    <>
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(135deg,#0d2a2b,#071112_62%)] px-5 py-6 text-white shadow-depth-lg desk:px-7 desk:py-7">
        <Weave id="home-weave" className="absolute inset-0 h-full w-full" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[12px] font-extrabold tracking-[2px] text-teal uppercase">{greeting()}</span>
            <h1 className="font-display text-[26px] leading-tight font-semibold desk:text-[34px]">{first ? `${first}, here's your week` : "Welcome to VentureWeavers"}</h1>
            <p className="max-w-[56ch] text-[14px] text-ink-muted">{line}</p>
            <LinkButton href="/my-space?tab=profile" variant="ghost" size="sm" className="mt-1 self-start !px-0 !text-teal hover:!bg-transparent hover:underline">
              <Pencil size={13} aria-hidden="true" />
              Edit interests
            </LinkButton>
          </div>
          {show && new Date(show.starts_at).getTime() > now ? <Countdown to={show.starts_at} label={`to ${show.title}`} /> : null}
        </div>
      </section>

      <div className="grid auto-rows-[minmax(150px,auto)] gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] desk:grid-cols-4">
        <NextShowTile show={show} />
        <LearningTileView t={learning} />
        <MeetingTileView t={meeting} />
        <EpisodeTile item={episode} image={episodeImage} />
        <QuidQuoTile stages={stages} onWaitlist={Boolean(waitlist)} />
        {wide1}
        {pool.slice(0, 2)}
        {wide2 && pool.length >= 4 ? <AnnouncementsTile posts={announcements} /> : null}
        {wide2 && pool.length >= 4 ? pool.slice(2, 4) : null}
        {wide2 && pool.length === 3 ? <AnnouncementsTile posts={announcements} className="desk:col-span-3" /> : null}
        {wide2 && pool.length === 3 ? pool[2] : null}
      </div>

      <Stitch />

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
            Your feed shows updates from Outloud, TVS, BRICKR and QuidQuo. <Link href="/sign-in" className="font-bold text-link">Sign in</Link> to see it.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
