import Link from "next/link";
import { cn } from "@/lib/cn";

/** Filter chips that are links (?space=…), so the filter works without JavaScript and survives reloads. */
export function ChipLinks({ label, items }: { label: string; items: { href: string; label: string; on: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          scroll={false}
          aria-current={i.on ? "true" : undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-full border px-3 text-[12.5px] font-bold desk:h-[30px]",
            i.on ? "border-fg bg-fg text-bg" : "border-line2 bg-card text-fg hover:bg-hover",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
