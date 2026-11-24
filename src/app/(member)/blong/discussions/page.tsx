import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { DiscussionCard } from "@/components/blong/discussion-card";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { FilterBar } from "@/components/blong/filter-bar";
import { DISCUSSION_SORTS, filterDiscussions, opts, pick, pickText, ROOM_JOIN_OPTS, ROOM_STATUS_OPTS, roomCommunities } from "@/lib/blong/filters";
import { SectionSoon } from "@/components/blong/review";
import { DISCUSSION_CATEGORIES, DISCUSSION_TABS, isDiscussionTab, type DiscussionTab } from "@/lib/blong/discussions";
import { listDiscussions, blongSections } from "@/lib/blong/queries";

export const metadata: Metadata = { title: "Discussions" };

/** BLong › Discussions: open rooms to join, the ones you're in, and the ones you host. */
export default async function DiscussionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireMember("/blong/discussions");
  if (!(await blongSections()).discussions) return <SectionSoon section="discussions" />;
  const sp = await searchParams;
  const { tab: raw, q = "", category: rawCat } = sp;
  const tab: DiscussionTab = isDiscussionTab(raw) ? raw : "explore";
  const category = (DISCUSSION_CATEGORIES as readonly string[]).includes(rawCat ?? "") ? rawCat! : "";
  const [list, joined] = await Promise.all([
    listDiscussions(tab, tab === "explore" ? { q, category } : {}),
    tab === "joined" ? Promise.resolve([]) : listDiscussions("joined"),
  ]);
  const invites = (tab === "joined" ? list : joined).filter((d) => d.my_status === "invited").length;
  const communities = roomCommunities(list);
  const f = {
    community: pick(sp, "community", ["none", ...communities.map((c) => c.value)]),
    privacy: pick(sp, "privacy", ROOM_JOIN_OPTS.map((o) => o.value)),
    status: pick(sp, "status", ROOM_STATUS_OPTS.map((o) => o.value)),
    room: sp.room === "1",
    tag: pickText(sp, "tag"),
    sort: pick(sp, "sort", DISCUSSION_SORTS.map((o) => o.value)),
  };
  const shown = filterDiscussions(list, f);
  const tags = [...new Set(list.flatMap((d) => d.tags.map((t) => t.toLowerCase())))].sort().slice(0, 40);
  const href = (t: string) => (t === "explore" ? "/blong/discussions" : `/blong/discussions?tab=${t}`);
  const catHref = (c: string) => `/blong/discussions?${new URLSearchParams({ ...(q ? { q } : {}), ...(c ? { category: c } : {}) })}`;

  return (
    <div className="bl flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LinkTabs label="Discussions" value={tab} hrefFor={href} items={DISCUSSION_TABS.map((t) => ({ value: t.value, label: t.label, count: t.value === "joined" ? invites || null : null }))} />
        <LinkButton href="/blong/discussions/new" scroll={false} className="bl-follow"><Plus size={15} aria-hidden="true" />Start a discussion</LinkButton>
      </div>

      {tab === "explore" ? (
        <>
          <form action="/blong/discussions" className="flex flex-wrap items-center gap-2" role="search">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line2 bg-card/70 px-3 text-faint focus-within:border-primary">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search discussions</span>
              <input name="q" defaultValue={q} placeholder="Search by title, tag or description" className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint" />
            </label>
            {category ? <input type="hidden" name="category" value={category} /> : null}
          </form>
          <nav aria-label="Filter by category" className="no-scrollbar -mt-1 flex gap-1.5 overflow-x-auto pb-1">
            <Link href={catHref("")} scroll={false} aria-current={!category ? "true" : undefined} className="bl-pill">All</Link>
            {DISCUSSION_CATEGORIES.map((c) => <Link key={c} href={catHref(c)} scroll={false} aria-current={category === c ? "true" : undefined} className="bl-pill">{c}</Link>)}
          </nav>
        </>
      ) : null}

      <FilterBar
        action="/blong/discussions"
        keep={{ tab: tab === "explore" ? "" : tab, q: tab === "explore" ? q : "", category: tab === "explore" ? category : "" }}
        clearHref={tab === "explore" ? catHref(category) : href(tab)}
        selects={[
          { name: "community", label: "Community", options: [{ value: "none", label: "Not in a community" }, ...communities], value: f.community },
          { name: "privacy", label: "Who can join", options: ROOM_JOIN_OPTS, value: f.privacy },
          { name: "status", label: "Open or closed", options: ROOM_STATUS_OPTS, value: f.status },
          { name: "tag", label: "Tag", options: opts(tags), value: f.tag },
        ]}
        checks={[{ name: "room", label: "Has room to join", checked: f.room }]}
        sort={{ name: "sort", label: "Sort", options: DISCUSSION_SORTS, value: f.sort, any: "Suggested" }}
      />

      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((d) => <DiscussionCard key={d.id} d={d} />)}
        </div>
      ) : (
        <EmptyState>
          {list.length ? "None match these filters. Try fewer."
            : tab === "explore"
            ? q || category ? "No discussions match. Try another word or category." : <>No open discussions yet. <Link href="/blong/discussions/new" className="font-bold text-link">Start the first one</Link>.</>
            : tab === "joined" ? <>You haven&apos;t joined a discussion yet. <Link href="/blong/discussions" className="font-bold text-link">Explore discussions</Link>.</>
            : <>You don&apos;t host a discussion yet. <Link href="/blong/discussions/new" className="font-bold text-link">Start one</Link>.</>}
        </EmptyState>
      )}
    </div>
  );
}
