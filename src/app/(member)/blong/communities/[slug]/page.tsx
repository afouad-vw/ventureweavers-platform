import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Lock, MessagesSquare, Pencil, Plus, Users } from "lucide-react";
import { CommunityCover } from "@/components/blong/community-card";
import { CommunityOwnerZone, InviteBox, JoinControls, PeopleList, ReportCommunity } from "@/components/blong/community-actions";
import { MemberAvatar } from "@/components/blong/member-avatar";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { ReviewBanner, SectionSoon } from "@/components/blong/review";
import { reviewChip } from "@/lib/blong/format";
import { communityPage, communityPeople, listDiscussions, blongSections } from "@/lib/blong/queries";
import { DiscussionCard } from "@/components/blong/discussion-card";

export const metadata: Metadata = { title: "Community" };

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", month: "long", year: "numeric" }).format(new Date(iso));

/** A community: About, its discussions, and Members (with requests for its admins). */
export default async function CommunityPageView({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab: raw } = await searchParams;
  const me = await requireMember(`/blong/communities/${slug}`);
  if (!(await blongSections()).communities) return <SectionSoon section="communities" />;
  const c = await communityPage(slug);
  if (!c) notFound();
  const admin = c.my_status === "active" && (c.my_role === "owner" || c.my_role === "admin");
  const tabs = [
    { value: "about", label: "About" },
    { value: "discussions", label: "Discussions" },
    { value: "members", label: "Members", count: admin && c.requests ? c.requests : null },
  ];
  const tab = tabs.some((t) => t.value === raw) ? raw! : "about";
  const [people, rooms] = await Promise.all([
    tab === "members" && c.can_see_inside ? communityPeople(c.id) : Promise.resolve([]),
    tab === "discussions" && c.can_see_inside ? listDiscussions("explore", { community: c.id }) : Promise.resolve([]),
  ]);

  return (
    <div className="bl flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <CommunityCover c={c} className="aspect-[16/5] w-full" />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <span className="bl-chip soft">{c.type}</span>
              <span className="bl-chip soft">{c.visibility === "private" ? <><Lock size={11} aria-hidden="true" />Private</> : <><Globe size={11} aria-hidden="true" />Public</>}</span>
              {c.status === "archived" ? <span className="bl-chip soft">Archived</span> : null}
              {reviewChip(c.status) ? <span className={`bl-chip review ${reviewChip(c.status)!.tone}`}>{reviewChip(c.status)!.label}</span> : null}
            </div>
            <h1 className="mt-2 font-display text-[26px] leading-tight font-semibold">{c.name}</h1>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-faint"><Users size={14} aria-hidden="true" />{c.members} {c.members === 1 ? "member" : "members"}{c.my_status === "active" ? ` · You're ${c.my_role === "owner" ? "the owner" : c.my_role === "admin" ? "an admin" : "a member"}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JoinControls c={c} />
            {admin ? <LinkButton href={`/blong/communities/${c.slug}/edit`} variant="secondary" scroll={false}><Pencil size={14} aria-hidden="true" />Edit</LinkButton> : null}
          </div>
        </div>
      </Card>

      {c.status === "archived" ? (
        <p className="bl-note rounded-xl border px-3.5 py-2.5 text-[13px]">
          {c.archived_by_team ? "The VentureWeavers team archived this community. Message the team if you think that's a mistake." : "This community is archived: it's hidden from Explore and nobody can join. Restore it below."}
        </p>
      ) : null}

      <ReviewBanner kind="community" status={c.status} note={c.review_note} resubmitted={c.resubmitted} editHref={admin ? `/blong/communities/${c.slug}/edit` : null} />

      <LinkTabs label="Community" value={tab} hrefFor={(v) => (v === "about" ? `/blong/communities/${c.slug}` : `/blong/communities/${c.slug}?tab=${v}`)} items={tabs} />

      {tab === "about" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <h2 className="bl-sec">About</h2>
            <p className="text-[14px] whitespace-pre-line">{c.description}</p>
            {c.topics.length ? (
              <>
                <h2 className="bl-sec mt-3">Topics</h2>
                <div className="flex flex-wrap gap-1.5">{c.topics.map((t) => <span key={t} className="bl-pill">{t}</span>)}</div>
              </>
            ) : null}
          </Card>
          <Card>
            <h2 className="bl-sec">For</h2>
            <p className="text-[13.5px]">{c.audience.length ? c.audience.join(", ") : "Everyone in the VentureWeavers community"}</p>
            {c.owner ? (
              <>
                <h2 className="bl-sec mt-3">Owner</h2>
                <Link href={`/blong/members/${c.owner.id}`} scroll={false} className="flex items-center gap-2.5">
                  <MemberAvatar id={c.owner.id} name={c.owner.name} src={c.owner.avatar_url} size={36} />
                  <b className="text-[14px]">{c.owner.name}</b>
                </Link>
              </>
            ) : null}
            <p className="mt-2 text-[12.5px] text-faint">Started {when(c.created_at)}</p>
          </Card>
        </div>
      ) : null}

      {tab === "discussions" ? (
        c.can_see_inside ? (
          <div className="flex flex-col gap-3">
            {c.my_status === "active" && c.status === "active" ? (
              <LinkButton href={`/blong/discussions/new?community=${c.id}`} scroll={false} className="bl-follow self-start"><Plus size={15} aria-hidden="true" />Start a discussion here</LinkButton>
            ) : null}
            {rooms.length ? (
              <div className="grid gap-3 sm:grid-cols-2">{rooms.map((d) => <DiscussionCard key={d.id} d={d} showCommunity={false} />)}</div>
            ) : (
              <EmptyState>
                <MessagesSquare size={22} className="mx-auto mb-2" aria-hidden="true" />
                {c.my_status === "active" ? "No discussions here yet. Start the first one." : c.visibility === "public" ? "No discussions yet. Join the community to start one." : "No discussions yet."}
              </EmptyState>
            )}
          </div>
        ) : (
          <div className="bl-lock flex flex-col items-center gap-2 rounded-[22px] border border-dashed px-5 py-9 text-center">
            <Lock size={22} aria-hidden="true" />
            <b className="font-display text-[19px] font-semibold">Private community</b>
            <p className="max-w-[440px] text-[13.5px] text-faint">Discussions show once an admin accepts your request.</p>
          </div>
        )
      ) : null}

      {tab === "members" ? (
        c.can_see_inside ? (
          <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px]">
            <Card><PeopleList c={c} people={people} me={me.id} /></Card>
            {admin && c.status === "active" ? (
              <Card>
                <h2 className="bl-sec">Invite members</h2>
                <InviteBox id={c.id} />
              </Card>
            ) : null}
          </div>
        ) : (
          <div className="bl-lock flex flex-col items-center gap-2 rounded-[22px] border border-dashed px-5 py-9 text-center">
            <Lock size={22} aria-hidden="true" />
            <b className="font-display text-[19px] font-semibold">Private community</b>
            <p className="max-w-[440px] text-[13.5px] text-faint">
              {c.my_status === "requested" ? "Your request is with the admins. Members show here once they accept." : "Members and discussions show once an admin accepts your request."}
            </p>
          </div>
        )
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/blong/communities" scroll={false} className="text-[13px] font-bold text-link">All communities</Link>
        <span className="flex flex-wrap gap-2">
          <CommunityOwnerZone c={c} />
          {c.my_role !== "owner" && c.status === "active" ? <ReportCommunity id={c.id} name={c.name} /> : null}
        </span>
      </div>
    </div>
  );
}
