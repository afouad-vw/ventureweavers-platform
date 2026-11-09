import Image from "next/image";
import { Briefcase, Cpu, GraduationCap, Mail, Mic, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TagTone } from "./tag";

export const BANNER_OPTIONS = ["Pattern", "Stage", "Round", "Room", "Audience", "Show", "Crowd"] as const;
export type BannerChoice = (typeof BANNER_OPTIONS)[number];

const photos: Partial<Record<BannerChoice, string>> = {
  Stage: "/images/stage.jpg",
  Round: "/images/round.jpg",
  Room: "/images/room.jpg",
  Audience: "/images/hands.jpg",
  Show: "/images/show.jpg",
  Crowd: "/images/crowd.jpg",
};

const bg: Record<TagTone, string> = {
  Outloud: "bg-[#7a4700]",
  TVS: "bg-[#1c3f86]",
  BRICKR: "bg-[#8a3a1e]",
  QuidQuo: "bg-[#3f5a0a]",
  House: "bg-deep",
};

const mark: Record<TagTone, LucideIcon> = {
  Outloud: Mic,
  TVS: GraduationCap,
  BRICKR: Briefcase,
  QuidQuo: Cpu,
  House: Mail,
};

/**
 * Banner for content cards: a photo (always cropped, never stretched) or the brand pattern
 * in the space's colour with a large faint icon.
 */
export function Banner({
  choice = "Pattern",
  thread,
  label,
  height = 130,
  chip,
  chipRight,
  className,
  src: customSrc,
}: {
  src?: string | null;
  choice?: BannerChoice;
  thread: TagTone;
  label?: string;
  height?: number;
  chip?: React.ReactNode;
  chipRight?: React.ReactNode;
  className?: string;
}) {
  const src = customSrc || photos[choice];
  const Mark = mark[thread];
  return (
    <div className={cn("relative flex shrink-0 items-end overflow-hidden px-3.5 py-3 text-white", bg[thread], !src && "vw-pattern", className)} style={{ height }}>
      {src ? (
        <>
          <Image src={src} alt="" fill sizes="(max-width: 900px) 100vw, 900px" className="object-cover" />
          <span className="absolute inset-0 bg-gradient-to-b from-ink/5 from-20% to-ink/80" aria-hidden="true" />
        </>
      ) : (
        <Mark aria-hidden="true" className="absolute -top-4 -right-3 h-[120px] w-[120px] opacity-20" strokeWidth={1.1} />
      )}
      {chip ? <span className="absolute top-2.5 left-2.5 z-10 inline-flex h-[22px] items-center gap-1 rounded-md bg-ink/75 px-2 text-[11px] font-bold">{chip}</span> : null}
      {chipRight ? <span className="absolute top-2.5 right-2.5 z-10 inline-flex h-[22px] items-center rounded-md bg-teal px-2 text-[11px] font-bold text-ink">{chipRight}</span> : null}
      {label ? <span className="relative z-10 font-display text-[22px] leading-none font-bold">{label}</span> : null}
    </div>
  );
}
