import Link from "next/link";
import { ArrowRight, Lock, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { communityCta, type CommunityRow } from "@/lib/blong/communities";
import { reviewChip } from "@/lib/blong/format";

const PRESETS = ["/images/crowd.jpg", "/images/round.jpg", "/images/room.jpg", "/images/hands.jpg"];

/** A preset photo picked steadily from the community's id, for communities without a cover. */
export function coverFor(c: { id: string; cover_url: string | null }) {
  if (c.cover_url) return c.cover_url;
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PRESETS[h % PRESETS.length];
}

export function CommunityCover({ c, className }: { c: { id: string; cover_url: string | null; name: string }; className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden bg-[#2a1f55]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- member upload or preset photo, cropped */}
      <img src={coverFor(c)} alt="" className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#120c2a]/70" aria-hidden="true" />
    </span>
  );
}

/** A community in Explore, Joined and Owned: cover, name, type, description, members and the next step. */
export function CommunityCard({ c }: { c: CommunityRow }) {
  return (
    <Link href={`/blong/communities/${c.slug}`} scroll={false} className="bl-tile glass flex min-w-0 flex-col overflow-hidden rounded-[20px] border">
      <span className="relative">
        <CommunityCover c={c} className="aspect-[16/7] w-full" />
        <span className="absolute top-2.5 left-2.5 flex gap-1.5">
          <span className="bl-chip">{c.type}</span>
          {c.visibility === "private" ? <span className="bl-chip lock"><Lock size={11} aria-hidden="true" />Private</span> : null}
        </span>
        {c.status === "archived" ? <span className="absolute top-2.5 right-2.5 bl-chip">Archived</span> : null}
        {reviewChip(c.status) ? <span className={`absolute top-2.5 right-2.5 bl-chip review ${reviewChip(c.status)!.tone}`}>{reviewChip(c.status)!.label}</span> : null}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3.5">
        <b className="font-display text-[17px] leading-tight font-semibold">{c.name}</b>
        <span className="line-clamp-2 text-[13px] text-faint">{c.description}</span>
        {c.topics.length ? <span className="line-clamp-1 text-[12px] font-bold text-muted">{c.topics.join(" · ")}</span> : null}
        <span className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[12.5px]">
          <span className="inline-flex items-center gap-1 text-faint"><Users size={13} aria-hidden="true" />{c.members} {c.members === 1 ? "member" : "members"}</span>
          <span className="bl-go inline-flex items-center gap-1 font-extrabold">{communityCta(c)}<ArrowRight size={13} aria-hidden="true" /></span>
        </span>
      </span>
    </Link>
  );
}
