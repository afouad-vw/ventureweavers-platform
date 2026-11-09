"use client";

import { cn } from "@/lib/cn";

export type TabItem<T extends string> = { value: T; label: string; count?: number | null };

/** Underlined tabs. Controlled: the parent keeps the selected value. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-line">
      {items.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px h-[38px] cursor-pointer border-b-2 px-3 text-[13.5px] font-bold whitespace-nowrap",
              on ? "border-teal text-fg" : "border-transparent text-faint hover:text-fg",
            )}
          >
            {t.label}
            {t.count != null ? <span className="ml-1 rounded-lg bg-hover px-1.5 py-px text-[11px] text-faint">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
