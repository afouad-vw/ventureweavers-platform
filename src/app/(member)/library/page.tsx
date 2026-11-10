import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Search } from "lucide-react";
import { GetResourceButton, SaveButton } from "@/components/content/member-buttons";
import { Card } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip-link";
import { EmptyState, Eyebrow, PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { accessLabel, isSpace, LIBRARY_KINDS, OPEN_LEVELS } from "@/lib/content/format";
import { libraryResources, mySavedKeys } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Library" };

const LABELS: Record<string, string> = { All: "All", Report: "Reports", Guide: "Guides", Template: "Templates", "AI skill": "AI skills" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const { type: rawType, q: rawQ } = await searchParams;
  const type = (LIBRARY_KINDS as readonly string[]).includes(rawType ?? "") ? rawType! : "All";
  const q = (rawQ ?? "").trim().slice(0, 80);
  const member = await getMember();

  const header = <PageHeader title="Library" description="Reports, guides, templates and AI skills from the house." />;
  if (!member) {
    return (
      <>
        {header}
        <EmptyState>
          The Library is for members. <Link href="/sign-in?next=%2Flibrary" className="font-bold text-link">Sign in</Link> or{" "}
          <Link href="/join" className="font-bold text-link">join</Link> to open it.
        </EmptyState>
      </>
    );
  }

  const [all, saved] = await Promise.all([libraryResources(), mySavedKeys()]);
  const needle = q.toLowerCase();
  const items = all.filter((r) => (type === "All" || r.kind === type) && (!needle || `${r.title} ${r.description}`.toLowerCase().includes(needle)));
  const qs = (t: string) => {
    const p = new URLSearchParams();
    if (t !== "All") p.set("type", t);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/library?${s}` : "/library";
  };

  return (
    <>
      {header}
      <div className="flex flex-wrap items-center gap-3">
        <form action="/library" className="relative flex w-full max-w-[340px] items-center" role="search">
          {type !== "All" ? <input type="hidden" name="type" value={type} /> : null}
          <Search size={16} className="pointer-events-none absolute left-2.5 text-faint" aria-hidden="true" />
          <label htmlFor="libq" className="sr-only">Search the library</label>
          <input
            id="libq"
            name="q"
            defaultValue={q}
            placeholder="Search the library"
            className="h-10 w-full rounded-lg border border-line2 bg-card pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9"
          />
        </form>
        <ChipLinks label="Filter by type" items={["All", ...LIBRARY_KINDS].map((k) => ({ href: qs(k), label: LABELS[k], on: type === k }))} />
      </div>

      {items.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {items.map((r) => {
            const open = (OPEN_LEVELS as string[]).includes(r.access);
            return (
              <Card as="article" key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow>{r.kind}</Eyebrow>
                  <ThreadTag thread={isSpace(r.space) ? r.space : "House"} />
                </div>
                <h3 className="text-[15px] font-extrabold">{r.title}</h3>
                {r.description ? <p className="line-clamp-3 text-[13px] text-muted">{r.description}</p> : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <span className="inline-flex items-center gap-1 text-[12.5px] text-faint">
                    {open ? null : <Lock size={13} aria-hidden="true" />}
                    {accessLabel(r.access)}
                  </span>
                  <span className="flex items-center gap-1">
                    <SaveButton type="resource" id={r.id} saved={saved.has(`resource:${r.id}`)} signedIn compact />
                    <GetResourceButton id={r.id} isSkill={r.kind === "AI skill"} locked={!open} available={r.ready} />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState>No resources match. Try another word or type.</EmptyState>
      )}
    </>
  );
}
