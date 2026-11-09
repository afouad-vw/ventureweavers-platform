"use client";

import { cn } from "@/lib/cn";

/** A toggle chip for filters. Pass `pressed` to show it as selected. */
export function Chip({
  pressed,
  onClick,
  children,
  className,
}: {
  pressed?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-9 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold desk:h-[30px]",
        pressed ? "border-fg bg-fg text-bg" : "border-line2 bg-card text-fg hover:bg-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A row of single-choice filter chips. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  renderLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  renderLabel?: (v: T) => React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip key={o} pressed={o === value} onClick={() => onChange(o)}>
          {renderLabel ? renderLabel(o) : o}
        </Chip>
      ))}
    </div>
  );
}
