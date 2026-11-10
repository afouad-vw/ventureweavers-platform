"use client";

import { useEffect, useState } from "react";

function parts(to: number, now: number) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  return [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60)];
}

/** Days, hours and minutes to a moment; ticks every 30 seconds. */
export function Countdown({ to, label }: { to: string; label: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [d, h, m] = parts(target, now ?? target);
  const cells: [number, string][] = [[d, "days"], [h, "hrs"], [m, "min"]];
  return (
    <div className="flex flex-wrap items-end gap-2.5" role="timer" aria-label={now === null ? label : `${d} days ${h} hours ${m} minutes ${label}`}>
      {cells.map(([n, l]) => (
        <div key={l} className="flex min-w-[62px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-md">
          <b className="font-display text-[30px] leading-none tabular-nums desk:text-[34px]">{now === null ? "––" : String(n).padStart(2, "0")}</b>
          <span className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">{l}</span>
        </div>
      ))}
      <span className="pb-2 text-[12.5px] text-ink-muted">{label}</span>
    </div>
  );
}
