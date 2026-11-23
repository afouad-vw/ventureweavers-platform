import Link from "next/link";
import { cn } from "@/lib/cn";

/** Underlined tabs that are links (?tab=...), so the selected tab survives reloads and works without JavaScript. */
export function LinkTabs({
  items,
  value,
  hrefFor,
  label,
  sections,
}: {
  items: { value: string; label: string; count?: number | null }[];
  value: string;
  hrefFor: (v: string) => string;
  label: string;
  /** The space's top-level sections: hidden in the house panel, where the space's icons pick them. */
  sections?: boolean;
}) {
  return (
    <nav aria-label={label} data-section-tabs={sections ? "" : undefined} className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-line">
      {items.map((t) => {
        const on = t.value === value;
        return (
          <Link
            key={t.value}
            href={hrefFor(t.value)}
            aria-current={on ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px inline-flex h-[38px] items-center border-b-2 px-3 text-[13.5px] font-bold whitespace-nowrap",
              on ? "border-teal text-fg" : "border-transparent text-faint hover:text-fg",
            )}
          >
            {t.label}
            {t.count != null ? <span className="ml-1 rounded-lg bg-hover px-1.5 py-px text-[11px] text-faint">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
