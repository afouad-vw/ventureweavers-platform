import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { threadDot, type TagTone } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { relativeWhen } from "@/lib/content/format";
import { attentionCounts, loadPeople } from "@/lib/contacts/queries";
import { adminListEvents } from "@/lib/events/admin-queries";

export const metadata: Metadata = { title: "Overview" };

const SPACES: TagTone[] = ["Outloud", "TVS", "BRICKR", "QuidQuo"];
const BAR: Record<TagTone, string> = { Outloud: "bg-out", TVS: "bg-tvs", BRICKR: "bg-brk", QuidQuo: "bg-qq", House: "bg-teal" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const base = await currentAdminBase();
  const [{ contacts, activity }, counts, shows, classes] = await Promise.all([loadPeople(), attentionCounts(), adminListEvents("outloud"), adminListEvents("masterclasses")]);
  const now = Date.now();
  const upcoming = [...shows, ...classes]
    .filter((e) => e.status === "published" && e.starts_at && new Date(e.starts_at).getTime() > now && e.capacity > 0)
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
  const seats = upcoming.reduce((n, e) => n + e.confirmed + e.reserved, 0);
  const bySpace = SPACES.map((s) => contacts.filter((c) => c.spaces.includes(s as never)).length);
  const max = Math.max(1, ...bySpace);
  const c = counts ?? { questions: 0, newRequests: 0, newApps: 0, payments: 0, toReview: 0, newTopics: 0, waitlist: 0, drafts: 0, openRequests: 0 };

  const kpis: [string, number, string][] = [
    ["Contacts", contacts.length, "bg-teal"],
    ["Seats booked", seats, "bg-out"],
    ["Open requests", c.openRequests, "bg-brk"],
    ["Hand-ins to review", c.toReview, "bg-tvs"],
    ["Waitlist", c.waitlist, "bg-qq"],
  ];
  const attention: [string, number, string][] = [
    ["questions to moderate", c.questions, "/outloud?tab=live"],
    ["new service requests", c.newRequests, "/requests"],
    ["new TVS applications", c.newApps, "/tvs?tab=apps"],
    ["payments waiting", c.payments, "/payments"],
    ["hand-ins to review", c.toReview, "/tvs?tab=classroom"],
    ["new topic suggestions", c.newTopics, "/outloud?tab=live"],
    ["drafts not published", c.drafts, "/publishing"],
  ];

  return (
    <>
      <PageHeader title="Overview" description="Key numbers, what needs attention, and recent activity from the member app." />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {kpis.map(([l, v, dot]) => (
          <div key={l} className="glass rounded-2xl border p-3.5">
            <small className="flex items-center gap-1.5 text-[12px] font-bold text-faint"><i className={cn("h-2 w-2 rounded-full", dot)} aria-hidden="true" />{l}</small>
            <b className="font-display text-[26px]">{v}</b>
          </div>
        ))}
      </div>

      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Seats by event" action={<Link href={`${base}/outloud`} className="text-link">Manage events</Link>} />
            {upcoming.length ? (
              <ul className="flex flex-col gap-2.5">
                {upcoming.map((e) => {
                  const taken = e.confirmed + e.reserved;
                  return (
                    <li key={e.id} className="flex items-center gap-2.5">
                      <Link href={`${base}/outloud/events/${e.id}`} className="w-[46%] shrink-0 truncate text-[13px] font-semibold hover:underline">{e.title}</Link>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden="true">
                        <span className={cn("block h-full rounded-full", e.type === "masterclass" ? "bg-tvs" : "bg-out")} style={{ width: `${Math.min(100, Math.round((taken / e.capacity) * 100))}%` }} />
                      </span>
                      <span className="w-[60px] text-right text-[12.5px] text-faint">{taken}/{e.capacity}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="text-[13px] text-faint">No upcoming events with seats.</span>
            )}
          </Card>
          <Card>
            <CardHeader title="Latest activity" action={<Link href={`${base}/contacts`} className="text-link">Contacts</Link>} />
            {activity.length ? (
              <ul className="flex flex-col">
                {activity.slice(0, 12).map((a) => (
                  <li key={a.key} className="flex items-center gap-2.5 border-b border-line py-2 last:border-b-0">
                    <i className={cn("h-2 w-2 shrink-0 rounded-full", threadDot[a.space])} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-[13.5px]">{a.text}</span>
                    <span className="shrink-0 text-[12px] text-faint">{relativeWhen(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Activity from members appears here.</EmptyState>
            )}
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Needs attention" />
            <ul className="flex flex-col">
              {attention.map(([label, n, href]) => (
                <li key={label}>
                  <Link href={`${base}${href}`} className={cn("flex items-center gap-2 border-b border-line py-2.5 text-[13.5px] last:border-b-0 hover:underline", !n && "text-faint")}>
                    <b className="w-7 font-display text-[15px]">{n}</b>
                    <span className="flex-1 font-semibold">{label}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Contacts by space" />
            <div className="flex h-[160px] items-end justify-around gap-2" role="img" aria-label={SPACES.map((s, i) => `${s}: ${bySpace[i]}`).join(", ")}>
              {SPACES.map((s, i) => (
                <div key={s} className="flex flex-1 flex-col items-center gap-1 text-[11.5px] font-bold text-faint">
                  <span className="font-display text-[14px] text-fg">{bySpace[i]}</span>
                  <i className={cn("w-full max-w-[38px] rounded-t-md", BAR[s])} style={{ height: `${Math.max(4, Math.round((bySpace[i] / max) * 110))}px` }} />
                  {s}
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
