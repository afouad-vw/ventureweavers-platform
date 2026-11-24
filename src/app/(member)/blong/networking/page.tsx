import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { MemberTile } from "@/components/blong/member-tile";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { isNetworkTab, NETWORK_TABS, type MemberLite, type NetworkTab } from "@/lib/blong/format";
import { blongFeed, memberCountries, memberSearch, myNetwork, myPrivacy } from "@/lib/blong/queries";
import { FilterBar } from "@/components/blong/filter-bar";
import { FEED_KINDS, filterFeed, MEMBER_SORTS, opts, pick, VISIBILITY_OPTS } from "@/lib/blong/filters";
import { BUSINESS_STAGES, BUSINESS_TYPES } from "@/lib/profile/about";
import { FeedList } from "@/components/blong/activity-list";
import { ROLES } from "@/lib/profile/options";

export const metadata: Metadata = { title: "Networking" };

const ROLE_FILTERS = ["Founder", "Angel Investor", "Institutional investor", "Corporate", "Venture Studio", "Mentor", "Expert"] as const;

/** BLong › Networking: find members, see what the people you follow are up to, and answer follow requests. */
export default async function NetworkingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMember("/blong/networking");
  const sp = await searchParams;
  const { tab: rawTab, q = "", role: rawRole } = sp;
  const tab: NetworkTab = isNetworkTab(rawTab) ? rawTab : "members";
  const role = (ROLES as readonly string[]).includes(rawRole ?? "") ? rawRole! : "";
  const [requests, privacy, countries] = await Promise.all([myNetwork("requests"), myPrivacy(me.id), tab === "members" ? memberCountries() : Promise.resolve([])]);
  const mf = {
    country: pick(sp, "country", countries),
    businessType: pick(sp, "btype", BUSINESS_TYPES),
    stage: pick(sp, "stage", BUSINESS_STAGES),
    visibility: pick(sp, "visibility", ["public", "private"]),
    followsMe: sp.follows === "1",
    sort: pick(sp, "sort", MEMBER_SORTS.map((o) => o.value)),
  };
  const kind = pick(sp, "kind", FEED_KINDS.map((o) => o.value));
  let list: MemberLite[] = [];
  let sent: MemberLite[] = [];
  const feed = tab === "feed" ? filterFeed(await blongFeed(), kind) : [];
  if (tab === "members") list = await memberSearch({ q, role, ...mf });
  else if (tab === "feed") list = [];
  else if (tab === "following") list = await myNetwork("following");
  else if (tab === "followers") list = await myNetwork("followers");
  else [list, sent] = [requests, await myNetwork("sent")];

  const href = (v: string) => (v === "members" ? "/blong/networking" : `/blong/networking?tab=${v}`);
  const filterHref = (r: string) => `/blong/networking?${new URLSearchParams({ ...(q ? { q } : {}), ...(r ? { role: r } : {}) })}`;

  return (
    <div className="bl flex flex-col gap-4">
      <LinkTabs
        label="Networking"
        value={tab}
        hrefFor={href}
        items={NETWORK_TABS.map((t) => ({ value: t.value, label: t.label, count: t.value === "requests" ? requests.length || null : null }))}
      />

      <p className="bl-note rounded-xl border px-3.5 py-2.5 text-[13px]">
        Your account is <b>{privacy.visibility === "public" ? "Public" : "Private"}</b>:{" "}
        {privacy.visibility === "public"
          ? "anyone in BLong can follow and message you and see your details."
          : "people ask to follow you, and see your details and can message you once you accept."}{" "}
        <Link href="/my-space?tab=privacy" scroll={false} className="font-bold text-link">Change</Link>
      </p>

      {tab === "members" ? (
        <>
          <form action="/blong/networking" className="flex flex-wrap items-center gap-2" role="search">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line2 bg-card/70 px-3 text-faint focus-within:border-primary">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search members</span>
              <input name="q" defaultValue={q} placeholder="Search by name or business" className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint" />
            </label>
            {role ? <input type="hidden" name="role" value={role} /> : null}
          </form>
          <nav aria-label="Filter by role" className="no-scrollbar -mt-1 flex gap-1.5 overflow-x-auto pb-1">
            <Link href={filterHref("")} scroll={false} aria-current={!role ? "true" : undefined} className="bl-pill">Everyone</Link>
            {ROLE_FILTERS.map((r) => (
              <Link key={r} href={filterHref(r)} scroll={false} aria-current={role === r ? "true" : undefined} className="bl-pill">{r}</Link>
            ))}
          </nav>
          <FilterBar
            action="/blong/networking"
            keep={{ q, role }}
            clearHref={filterHref(role)}
            selects={[
              { name: "country", label: "Country", options: opts(countries), value: mf.country },
              { name: "btype", label: "Business type", options: opts(BUSINESS_TYPES), value: mf.businessType },
              { name: "stage", label: "Venture stage", options: opts(BUSINESS_STAGES), value: mf.stage },
              { name: "visibility", label: "Public or Private", options: VISIBILITY_OPTS, value: mf.visibility },
            ]}
            checks={[{ name: "follows", label: "Follows you", checked: mf.followsMe }]}
            sort={{ name: "sort", label: "Sort", options: MEMBER_SORTS, value: mf.sort === "name" ? "" : mf.sort, any: "Name A to Z" }}
          />
        </>
      ) : tab === "feed" ? (
        <nav aria-label="Filter the feed" className="no-scrollbar -mt-1 flex gap-1.5 overflow-x-auto pb-1">
          <Link href="/blong/networking?tab=feed" scroll={false} aria-current={!kind ? "true" : undefined} className="bl-pill">Everything</Link>
          {FEED_KINDS.map((k) => <Link key={k.value} href={`/blong/networking?tab=feed&kind=${k.value}`} scroll={false} aria-current={kind === k.value ? "true" : undefined} className="bl-pill">{k.label}</Link>)}
        </nav>
      ) : null}

      {tab === "feed" ? (
        feed.length ? <FeedList items={feed} /> : (
          <EmptyState>
            {kind ? <>Nothing of this kind yet. <Link href="/blong/networking?tab=feed" className="font-bold text-link">See everything</Link>.</> : <>Nothing new from the people you follow. <Link href="/blong/networking" className="font-bold text-link">Find members to follow</Link>; what they share (shows, programs, communities, news and posts) shows up here.</>}
          </EmptyState>
        )
      ) : list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 desk:grid-cols-4">
          {list.map((m) => <MemberTile key={m.id} m={m} mode={tab === "requests" ? "request" : tab === "followers" ? "follower" : "follow"} />)}
        </div>
      ) : (
        <EmptyState>
          {tab === "members"
            ? q || role || mf.country || mf.businessType || mf.stage || mf.visibility || mf.followsMe ? "No members match. Try another name or fewer filters." : "No other members yet."
            : tab === "following" ? <>You don&apos;t follow anyone yet. <Link href="/blong/networking" className="font-bold text-link">Find members</Link></>
            : tab === "followers" ? "Nobody follows you yet."
            : "No follow requests waiting."}
        </EmptyState>
      )}

      {tab === "requests" && sent.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-extrabold">Requests you sent</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 desk:grid-cols-4">
            {sent.map((m) => <MemberTile key={m.id} m={m} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
