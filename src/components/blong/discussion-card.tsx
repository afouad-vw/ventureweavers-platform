import Link from "next/link";
import { ArrowRight, Lock, MessagesSquare, Users } from "lucide-react";
import { activeAgo, discussionCta, privacyLabel, type DiscussionRow } from "@/lib/blong/discussions";

/** A discussion in Explore, Joined, Owned and a community's Discussions tab. */
export function DiscussionCard({ d, showCommunity = true }: { d: DiscussionRow; showCommunity?: boolean }) {
  return (
    <Link href={`/blong/discussions/${d.slug}`} scroll={false} className="bl-tile glass flex min-w-0 flex-col gap-2 rounded-[20px] border p-4">
      <span className="flex flex-wrap gap-1.5">
        <span className="bl-chip soft">{d.category}</span>
        {d.privacy !== "public" ? <span className="bl-chip soft"><Lock size={11} aria-hidden="true" />{privacyLabel(d.privacy)}</span> : null}
        {showCommunity && d.community_name ? <span className="bl-chip soft"><Users size={11} aria-hidden="true" />{d.community_name}</span> : null}
        {d.status !== "open" ? <span className="bl-chip soft">{d.status === "closed" ? "Closed" : "Archived"}</span> : null}
      </span>
      <b className="font-display text-[17px] leading-tight font-semibold">{d.title}</b>
      {d.description ? <span className="line-clamp-2 text-[13px] text-faint">{d.description}</span> : null}
      <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-[12.5px]">
        <span className="flex flex-wrap gap-3 text-faint">
          <span className="inline-flex items-center gap-1"><Users size={13} aria-hidden="true" />{d.members} of {d.member_limit}</span>
          <span className="inline-flex items-center gap-1"><MessagesSquare size={13} aria-hidden="true" />{activeAgo(d.last_message_at)}</span>
        </span>
        <span className="bl-go inline-flex items-center gap-1 font-extrabold">{discussionCta(d)}<ArrowRight size={13} aria-hidden="true" /></span>
      </span>
    </Link>
  );
}
