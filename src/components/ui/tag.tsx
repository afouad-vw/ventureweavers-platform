import { cn } from "@/lib/cn";
import type { Thread } from "@/lib/nav";

export type TagTone = Thread | "House";

const tone: Record<TagTone, { box: string; dot: string }> = {
  Outloud: { box: "bg-out-bg text-out-fg", dot: "bg-out" },
  TVS: { box: "bg-tvs-bg text-tvs-fg", dot: "bg-tvs" },
  BRICKR: { box: "bg-brk-bg text-brk-fg", dot: "bg-brk" },
  QuidQuo: { box: "bg-qq-bg text-qq-fg", dot: "bg-qq" },
  House: { box: "bg-house-bg text-house-fg", dot: "bg-teal" },
};

export const threadDot: Record<TagTone, string> = {
  Outloud: tone.Outloud.dot,
  TVS: tone.TVS.dot,
  BRICKR: tone.BRICKR.dot,
  QuidQuo: tone.QuidQuo.dot,
  House: tone.House.dot,
};

/** Coloured tag for a space. "House" means VentureWeavers itself. */
export function ThreadTag({ thread, label, className }: { thread: TagTone; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 self-start rounded-md px-2 text-[11.5px] font-bold whitespace-nowrap", tone[thread].box, className)}>
      <i className={cn("h-[7px] w-[7px] rounded-full", tone[thread].dot)} aria-hidden="true" />
      {label ?? (thread === "House" ? "VentureWeavers" : thread)}
    </span>
  );
}

/** Small neutral tag for topics and attributes. */
export function MiniTag({ children, tone: t = "plain" }: { children: React.ReactNode; tone?: "plain" | "tvs" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[5px] px-[7px] text-[11px] font-bold whitespace-nowrap",
        t === "tvs" ? "bg-tvs-bg text-tvs-fg" : "bg-hover text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function TagRow({ tags, before }: { tags: string[]; before?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1">
      {before}
      {tags.map((t) => (
        <MiniTag key={t}>{t}</MiniTag>
      ))}
    </div>
  );
}

type PillTone = "ok" | "draft" | "warn" | "blue" | "bad";
const pillTone: Record<PillTone, string> = {
  ok: "bg-soft text-soft-fg",
  draft: "bg-hover text-faint",
  warn: "bg-warn-bg text-warn-fg",
  blue: "bg-tvs-bg text-tvs-fg",
  bad: "bg-bad-bg text-bad-fg",
};

/** Status pill: Published, Draft, Pending, Paid and so on. */
export function StatusPill({ tone: t, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11.5px] font-bold whitespace-nowrap", pillTone[t])}>
      <i className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Pick a pill tone from a common status word. */
export function statusTone(status: string): PillTone {
  if (["Published", "Open", "Paid", "Approved", "Won", "Reviewed", "Confirmed"].includes(status)) return "ok";
  if (["Draft", "Closed", "Hidden", "Refunded", "Expired", "Locked", "Cancelled"].includes(status)) return "draft";
  if (["Scheduled", "In development", "Submitted", "Intro call", "Upcoming"].includes(status)) return "blue";
  if (["Failed", "Declined"].includes(status)) return "bad";
  return "warn";
}
