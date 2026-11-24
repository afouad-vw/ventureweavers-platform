import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Pencil, Users } from "lucide-react";
import { InviteBox, PeopleList } from "@/components/blong/community-actions";
import { MemberAvatar } from "@/components/blong/member-avatar";
import { Room, RoomJoin, RoomManage } from "@/components/blong/room";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { requireMember } from "@/lib/auth/guards";
import { ReviewBanner, SectionSoon } from "@/components/blong/review";
import { reviewChip } from "@/lib/blong/format";
import { privacyLabel } from "@/lib/blong/discussions";
import { discussionPage, discussionPeople, roomMessages, blongSections } from "@/lib/blong/queries";

export const metadata: Metadata = { title: "Discussion" };

/** A discussion room: the live chat, its members (and requests for hosts), and what it's about. */
export default async function DiscussionRoomPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab: raw } = await searchParams;
  const me = await requireMember(`/blong/discussions/${slug}`);
  if (!(await blongSections()).discussions) return <SectionSoon section="discussions" />;
  const d = await discussionPage(slug);
  if (!d) notFound();
  const admin = d.my_status === "active" && (d.my_role === "owner" || d.my_role === "admin");
  const tabs = [
    { value: "room", label: "Room" },
    { value: "members", label: "Members", count: admin && d.requests ? d.requests : null },
    { value: "about", label: "About" },
  ];
  const tab = tabs.some((t) => t.value === raw) ? raw! : "room";
  const [messages, people] = await Promise.all([
    tab === "room" && d.can_read ? roomMessages(d.id) : Promise.resolve([]),
    tab === "members" ? discussionPeople(d.id) : Promise.resolve([]),
  ]);

  return (
    <div className="bl flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <span className="bl-chip soft">{d.category}</span>
            <span className="bl-chip soft">{d.privacy !== "public" ? <Lock size={11} aria-hidden="true" /> : null}{privacyLabel(d.privacy)}</span>
            {d.community ? <Link href={`/blong/communities/${d.community.slug}`} scroll={false} className="bl-chip soft"><Users size={11} aria-hidden="true" />{d.community.name}</Link> : null}
            {reviewChip(d.status) ? <span className={`bl-chip review ${reviewChip(d.status)!.tone}`}>{reviewChip(d.status)!.label}</span>
              : d.status !== "open" ? <span className="bl-chip soft">{d.status === "closed" ? "Closed" : "Archived"}</span> : null}
          </div>
          <h1 className="mt-2 font-display text-[24px] leading-tight font-semibold">{d.title}</h1>
          <p className="mt-0.5 text-[13px] text-faint">{d.members} of {d.member_limit} members{d.my_status === "active" ? ` · You're ${d.my_role === "owner" ? "the host" : d.my_role === "admin" ? "an admin" : "in"}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoomJoin d={d} />
          {admin ? <LinkButton size="sm" href={`/blong/discussions/${d.slug}/edit`} variant="secondary" scroll={false}><Pencil size={14} aria-hidden="true" />Edit</LinkButton> : null}
        </div>
      </div>

      {d.status === "archived" ? (
        <p className="bl-note rounded-xl border px-3.5 py-2.5 text-[13px]">
          {d.archived_by_team ? "The VentureWeavers team archived this discussion. Message the team if you think that's a mistake." : "This discussion is archived: it's hidden from Explore and nobody can post or join."}
        </p>
      ) : null}

      <ReviewBanner kind="discussion" status={d.status} note={d.review_note} resubmitted={d.resubmitted} editHref={admin ? `/blong/discussions/${d.slug}/edit` : null} />

      <LinkTabs label="Discussion" value={tab} hrefFor={(v) => (v === "room" ? `/blong/discussions/${d.slug}` : `/blong/discussions/${d.slug}?tab=${v}`)} items={tabs} />

      {tab === "room" ? (
        d.can_read ? (
          <Room d={d} me={me.id} initial={messages} />
        ) : (
          <div className="bl-lock flex flex-col items-center gap-2 rounded-[22px] border border-dashed px-5 py-9 text-center">
            <Lock size={22} aria-hidden="true" />
            <b className="font-display text-[19px] font-semibold">{d.privacy === "invite" ? "Invite only" : "Members only"}</b>
            <p className="max-w-[440px] text-[13.5px] text-faint">
              {d.my_status === "requested" ? "Your request is with the host. The conversation shows here once they accept." : d.my_status === "invited" ? "Accept the invite to read and join the conversation." : "Ask to join to read and take part in the conversation."}
            </p>
          </div>
        )
      ) : null}

      {tab === "members" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            {people.length ? <PeopleList kind="discussion" c={{ id: d.id, name: d.title, my_role: d.my_status === "active" ? d.my_role : null }} people={people} me={me.id} /> : <p className="text-[13px] text-faint">Members show here once you join.</p>}
          </Card>
          {admin && d.status === "open" ? (
            <Card>
              <h2 className="bl-sec">Invite members</h2>
              <InviteBox kind="discussion" id={d.id} />
              {d.community ? <p className="text-[12px] text-faint">Only members of {d.community.name} can be invited.</p> : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "about" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <h2 className="bl-sec">About</h2>
            <p className="text-[14px] whitespace-pre-line">{d.description || "No description."}</p>
            {d.tags.length ? (
              <>
                <h2 className="bl-sec mt-3">Tags</h2>
                <div className="flex flex-wrap gap-1.5">{d.tags.map((t) => <span key={t} className="bl-pill">{t}</span>)}</div>
              </>
            ) : null}
          </Card>
          {d.owner ? (
            <Card>
              <h2 className="bl-sec">Host</h2>
              <Link href={`/blong/members/${d.owner.id}`} scroll={false} className="flex items-center gap-2.5">
                <MemberAvatar id={d.owner.id} name={d.owner.name} src={d.owner.avatar_url} size={36} />
                <b className="text-[14px]">{d.owner.name}</b>
              </Link>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={d.community ? `/blong/communities/${d.community.slug}?tab=discussions` : "/blong/discussions"} scroll={false} className="text-[13px] font-bold text-link">
          {d.community ? `More in ${d.community.name}` : "All discussions"}
        </Link>
        <RoomManage d={d} />
      </div>
    </div>
  );
}
