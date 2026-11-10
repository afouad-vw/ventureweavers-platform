import type { Metadata } from "next";
import Link from "next/link";
import { LiveRoom } from "@/components/live/live-room";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { requireMember } from "@/lib/auth/guards";
import { loadLiveState, myLiveShows, myNextShow, showInfo } from "@/lib/live/queries";

export const metadata: Metadata = { title: "Live" };

export default async function LivePage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const me = await requireMember("/live");
  const { event: asked } = await searchParams;
  const live = await myLiveShows();
  // A show named in the link (from the feedback email), else the show that's live now, else the next booked show.
  const pick = live.find((s) => s.eventId === asked) ?? (asked ? await showInfo(asked) : null) ?? live[0] ?? (await myNextShow(me.id));
  const state = pick ? await loadLiveState(pick.eventId) : null;
  const title = pick?.title ?? "";

  return (
    <>
      <PageHeader above={<ThreadTag thread="Outloud" />} title="Live mode" description="Ask, vote and follow the show from your phone." />
      {pick && state ? (
        <LiveRoom eventId={pick.eventId} title={title} initial={state} />
      ) : (
        <EmptyState>
          {pick ? `Live mode for ${pick.title} is for people with a confirmed ticket. ` : "Live mode is for people with a confirmed ticket to a show. "}
          <Link href="/outloud" className="font-bold text-link">See upcoming shows</Link>
        </EmptyState>
      )}
    </>
  );
}
