import Link from "next/link";
import { CalendarDays, GraduationCap, Megaphone, Network } from "lucide-react";
import { activityDay, type Activity, type FeedItem } from "@/lib/blong/format";
import { MemberAvatar } from "./member-avatar";

const ICON = { events: CalendarDays, programs: GraduationCap, communities: Network, posts: Megaphone } as const;
const eventDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(new Date(iso));

/** One line of VW activity: what, where to, and when. */
function Line({ a }: { a: Activity }) {
  const Icon = ICON[a.kind];
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      <span className="bl-ico mt-0.5"><Icon size={14} aria-hidden="true" /></span>
      <span className="min-w-0 text-[13.5px]">
        <span className="text-faint">{a.verb} </span>
        <Link href={a.href} scroll={false} className="font-bold hover:underline">{a.title}</Link>
        {a.kind === "events" ? <span className="text-faint"> · {a.starts_at ? eventDate(a.starts_at) : "Date TBA"}</span> : null}
        <span className="block text-[12px] text-faint">{activityDay(a.at)}</span>
      </span>
    </span>
  );
}

/** A member's VW activity on their page. */
export function ActivityList({ items, first }: { items: Activity[]; first: string }) {
  if (!items.length) return <p className="text-[13px] text-faint">Nothing to show yet. Shows, programs, communities and news {first} shares appear here.</p>;
  return <ul className="flex flex-col gap-3">{items.map((a, i) => <li key={`${a.href}-${i}`}><Line a={a} /></li>)}</ul>;
}

/** Networking › Feed: updates from the people you follow. */
export function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((f, i) => (
        <li key={`${f.member_id}-${f.href}-${i}`} className="glass flex items-start gap-3 rounded-[18px] border p-3.5">
          <Link href={`/blong/members/${f.member_id}`} scroll={false} className="shrink-0"><MemberAvatar id={f.member_id} name={f.name} src={f.avatar_url} size={40} /></Link>
          <span className="min-w-0 flex-1">
            <Link href={`/blong/members/${f.member_id}`} scroll={false} className="text-[14px] font-extrabold hover:underline">{f.name}</Link>
            <span className="mt-1 block"><Line a={f} /></span>
          </span>
        </li>
      ))}
    </ul>
  );
}
