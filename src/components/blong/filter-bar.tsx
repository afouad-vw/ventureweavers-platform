"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import type { Option } from "@/lib/blong/filters";

export type FilterSelect = { name: string; label: string; options: Option[]; value: string; any?: string };
export type FilterCheck = { name: string; label: string; checked: boolean };

/**
 * Filters under a list: a "Filters" button opens selects and switches; each change updates the address (so a filtered
 * list can be shared) and the list. Works without JavaScript as a normal form with an Apply button.
 */
export function FilterBar({ action, keep, selects, checks = [], sort, clearHref }: {
  action: string;
  /** Values to carry over (tab, search, the pill chosen above). */
  keep: Record<string, string>;
  selects: FilterSelect[];
  checks?: FilterCheck[];
  sort?: FilterSelect;
  clearHref: string;
}) {
  const active = selects.filter((s) => s.value).length + checks.filter((c) => c.checked).length;
  const [open, setOpen] = useState(active > 0);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const go = () => {
    const f = form.current;
    if (!f) return;
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(f).entries()) if (String(v)) q.set(k, String(v));
    router.replace(`${action}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const field = (s: FilterSelect) => (
    <label key={s.name} className="flex min-w-0 flex-col gap-1 text-[12px] font-bold text-faint">
      {s.label}
      <select name={s.name} defaultValue={s.value} onChange={go} className="bl-select">
        <option value="">{s.any ?? "Any"}</option>
        {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <form ref={form} action={action} className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}>
      {Object.entries(keep).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="bl-pill inline-flex items-center gap-1.5" aria-expanded={open} aria-current={active ? "true" : undefined} onClick={() => setOpen((v) => !v)}>
          <SlidersHorizontal size={14} aria-hidden="true" />Filters{active ? ` (${active})` : ""}
        </button>
        {sort ? (
          <label className="ml-auto flex items-center gap-2 text-[12.5px] font-bold text-faint">
            Sort
            <select name={sort.name} defaultValue={sort.value} onChange={go} className="bl-select w-auto">
              {sort.any ? <option value="">{sort.any}</option> : null}
              {sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ) : null}
        {active ? <Link href={clearHref} scroll={false} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-link"><X size={13} aria-hidden="true" />Clear filters</Link> : null}
      </div>
      <div hidden={!open} className="glass grid gap-3 rounded-2xl border p-3 sm:grid-cols-2 desk:grid-cols-4">
        {selects.map(field)}
        {checks.map((c) => (
          <label key={c.name} className="flex items-center gap-2 self-end pb-2 text-[13px] font-bold">
            <input type="checkbox" name={c.name} value="1" defaultChecked={c.checked} onChange={go} className="h-4 w-4 accent-[#8DBF2E]" />
            {c.label}
          </label>
        ))}
        <noscript><button type="submit" className="bl-pill">Apply</button></noscript>
      </div>
    </form>
  );
}
