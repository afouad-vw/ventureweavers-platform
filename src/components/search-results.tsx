import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import type { SearchHit } from "@/lib/search";

/** Search box plus results grouped by kind (shows, programs, contacts…). */
export function SearchResults({ q, action, hits, placeholder, hint }: { q: string; action: string; hits: SearchHit[]; placeholder: string; hint: string }) {
  const groups = Array.from(new Set(hits.map((h) => h.group)));
  return (
    <>
      <form action={action} role="search" className="relative flex w-full max-w-[520px] items-center">
        <Search size={16} className="pointer-events-none absolute left-3 text-faint" aria-hidden="true" />
        <label htmlFor="search-q" className="sr-only">Search</label>
        <input id="search-q" name="q" type="search" defaultValue={q} maxLength={80} autoFocus={!q} placeholder={placeholder} className="h-11 w-full rounded-lg border border-line2 bg-card pr-3 pl-9 text-[14px] placeholder:text-faint focus:border-primary focus:outline-none" />
      </form>
      {!q ? (
        <EmptyState>{hint}</EmptyState>
      ) : !hits.length ? (
        <EmptyState>Nothing matches “{q}”. Try fewer or different words.</EmptyState>
      ) : (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {groups.map((g) => (
            <Card key={g}>
              <CardHeader title={g} action={<span className="font-normal text-faint">{hits.filter((h) => h.group === g).length}</span>} />
              <ul className="flex flex-col">
                {hits.filter((h) => h.group === g).map((h, i) => (
                  <li key={`${h.href}-${i}`}>
                    <Link href={h.href} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0 hover:bg-hover">
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px]">{h.title}</b>
                        {h.sub ? <span className="block truncate text-[12.5px] text-faint">{h.sub}</span> : null}
                      </span>
                      {h.space ? <ThreadTag thread={h.space} /> : null}
                      <ArrowRight size={14} className="shrink-0 text-faint" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
