import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { MemberTile } from "@/components/blong/member-tile";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { isNetworkTab, NETWORK_TABS, type MemberLite, type NetworkTab } from "@/lib/blong/format";
import { memberDirectory, myNetwork, myPrivacy } from "@/lib/blong/queries";
import { ROLES } from "@/lib/profile/options";

export const metadata: Metadata = { title: "Networking" };

const ROLE_FILTERS = ["Founder", "Angel Investor", "Institutional investor", "Corporate", "Venture Studio", "Mentor", "Expert"] as const;

/** BLong › Networking: find members, follow them, and answer follow requests. */
export default async function NetworkingPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; role?: string }> }) {
  const me = await requireMember("/blong/networking");
  const { tab: rawTab, q = "", role: rawRole } = await searchParams;
  const tab: NetworkTab = isNetworkTab(rawTab) ? rawTab : "members";
  const role = (ROLES as readonly string[]).includes(rawRole ?? "") ? rawRole! : "";
  const [requests, privacy] = await Promise.all([myNetwork("requests"), myPrivacy(me.id)]);
  let list: MemberLite[] = [];
  let sent: MemberLite[] = [];
  if (tab === "members") list = await memberDirectory(q, role);
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
        </>
      ) : null}

      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 desk:grid-cols-4">
          {list.map((m) => <MemberTile key={m.id} m={m} mode={tab === "requests" ? "request" : tab === "followers" ? "follower" : "follow"} />)}
        </div>
      ) : (
        <EmptyState>
          {tab === "members"
            ? q || role ? "No members match. Try another name or role." : "No other members yet."
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
