import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CommunityCard } from "@/components/blong/community-card";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { COMMUNITY_TABS, COMMUNITY_TYPES, isCommunityTab, type CommunityTab } from "@/lib/blong/communities";
import { listCommunities } from "@/lib/blong/queries";

export const metadata: Metadata = { title: "Communities" };

/** BLong › Communities: explore, the ones you joined, and the ones you own or help run. */
export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string }> }) {
  await requireMember("/blong/communities");
  const { tab: raw, q = "", type: rawType } = await searchParams;
  const tab: CommunityTab = isCommunityTab(raw) ? raw : "explore";
  const type = (COMMUNITY_TYPES as readonly string[]).includes(rawType ?? "") ? rawType! : "";
  const [list, joined] = await Promise.all([listCommunities(tab, tab === "explore" ? q : "", tab === "explore" ? type : ""), tab === "joined" ? Promise.resolve([]) : listCommunities("joined")]);
  const invites = (tab === "joined" ? list : joined).filter((c) => c.my_status === "invited").length;
  const href = (t: string) => (t === "explore" ? "/blong/communities" : `/blong/communities?tab=${t}`);
  const typeHref = (t: string) => `/blong/communities?${new URLSearchParams({ ...(q ? { q } : {}), ...(t ? { type: t } : {}) })}`;

  return (
    <div className="bl flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LinkTabs label="Communities" value={tab} hrefFor={href} items={COMMUNITY_TABS.map((t) => ({ value: t.value, label: t.label, count: t.value === "joined" ? invites || null : null }))} />
        <LinkButton href="/blong/communities/new" scroll={false} className="bl-follow"><Plus size={15} aria-hidden="true" />Create community</LinkButton>
      </div>

      {tab === "explore" ? (
        <>
          <form action="/blong/communities" className="flex flex-wrap items-center gap-2" role="search">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line2 bg-card/70 px-3 text-faint focus-within:border-primary">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search communities</span>
              <input name="q" defaultValue={q} placeholder="Search by name, topic or description" className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint" />
            </label>
            {type ? <input type="hidden" name="type" value={type} /> : null}
          </form>
          <nav aria-label="Filter by type" className="no-scrollbar -mt-1 flex gap-1.5 overflow-x-auto pb-1">
            <Link href={typeHref("")} scroll={false} aria-current={!type ? "true" : undefined} className="bl-pill">All types</Link>
            {COMMUNITY_TYPES.map((t) => <Link key={t} href={typeHref(t)} scroll={false} aria-current={type === t ? "true" : undefined} className="bl-pill">{t}</Link>)}
          </nav>
        </>
      ) : null}

      {list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 desk:grid-cols-3">
          {list.map((c) => <CommunityCard key={c.id} c={c} />)}
        </div>
      ) : (
        <EmptyState>
          {tab === "explore"
            ? q || type ? "No communities match. Try another word or type." : <>No communities yet. <Link href="/blong/communities/new" className="font-bold text-link">Start the first one</Link>.</>
            : tab === "joined" ? <>You haven&apos;t joined a community yet. <Link href="/blong/communities" className="font-bold text-link">Explore communities</Link>.</>
            : <>You don&apos;t run a community yet. <Link href="/blong/communities/new" className="font-bold text-link">Create one</Link>.</>}
        </EmptyState>
      )}
    </div>
  );
}
