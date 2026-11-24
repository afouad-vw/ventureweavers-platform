import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, ExternalLink, Globe, Link2, Lock, MapPin } from "lucide-react";
import { FollowButton, MemberSafety, MessageButton } from "@/components/blong/member-actions";
import { MemberAvatar } from "@/components/blong/member-avatar";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/auth/guards";
import { memberActivity, memberCard } from "@/lib/blong/queries";
import { ActivityList } from "@/components/blong/activity-list";

export const metadata: Metadata = { title: "Member" };

/** A member's page in BLong: as much as their privacy allows. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember(`/blong/members/${id}`);
  const [m, activity] = await Promise.all([memberCard(id), memberActivity(id)]);
  if (!m) notFound();
  const first = m.name.split(/\s+/)[0] || m.name;

  return (
    <div className="bl flex flex-col gap-4">
      <Card className="bl-hero sm:flex-row sm:items-center sm:gap-5">
        <MemberAvatar id={m.id} name={m.name} src={m.avatar_url} size={96} className="ring-4 ring-white/10" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] leading-tight font-semibold">{m.name}</h1>
          <p className="text-[14px] text-muted">{m.roles.join(", ") || "VentureWeavers member"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-faint">
            <span className="inline-flex items-center gap-1 font-extrabold">
              {m.visibility === "private" ? <Lock size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}
              {m.visibility === "private" ? "Private account" : "Public account"}
            </span>
            <span><b className="text-fg">{m.followers}</b> followers</span>
            <span><b className="text-fg">{m.following}</b> following</span>
            {m.follows_me ? <span className="font-bold">Follows you</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {m.self ? (
            <LinkButton href="/my-space?tab=privacy" variant="secondary" scroll={false}>Edit your card</LinkButton>
          ) : (
            <>
              <FollowButton id={m.id} state={m.follow_state} visibility={m.visibility} followsMe={m.follows_me} />
              {m.can_message ? <MessageButton id={m.id} /> : null}
            </>
          )}
        </div>
      </Card>

      {!m.open ? (
        <div className="bl-lock flex flex-col items-center gap-2 rounded-[22px] border border-dashed px-5 py-9 text-center">
          <Lock size={22} aria-hidden="true" />
          <b className="font-display text-[19px] font-semibold">This account is private</b>
          <p className="max-w-[440px] text-[13.5px] text-faint">
            {m.follow_state === "requested"
              ? `Your request is with ${first}. Once they accept, you'll see their details and can message them.`
              : `Ask to follow ${first} to see their details and VW activity, and to message them. They can accept or decline.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <h2 className="bl-sec">About</h2>
            <p className="text-[14px] whitespace-pre-line">{m.bio || `${first} hasn't written a bio yet.`}</p>
            {m.country ? <p className="inline-flex items-center gap-1.5 text-[13px] text-faint"><MapPin size={14} aria-hidden="true" />{m.country}</p> : null}
            <h2 className="bl-sec mt-3">VW activity</h2>
            <ActivityList items={activity} first={m.self ? "you" : first} />
          </Card>
          <Card>
            <h2 className="bl-sec">Businesses</h2>
            {m.businesses.length ? (
              <ul className="flex flex-col gap-2">
                {m.businesses.map((b) => (
                  <li key={b.name} className="flex items-start gap-2 text-[13.5px]">
                    <Briefcase size={15} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                    <span className="min-w-0">
                      {b.website ? <a href={b.website} target="_blank" rel="noreferrer" className="font-bold text-link">{b.name}</a> : <b>{b.name}</b>}
                      <span className="block text-[12.5px] text-faint">{[b.role, b.type].filter(Boolean).join(" · ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-faint">None listed.</p>
            )}
            {m.linkedin || m.links.length ? <h2 className="bl-sec mt-3">Links</h2> : null}
            <ul className="flex flex-col gap-1.5">
              {m.linkedin ? (
                <li><a href={m.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-link"><ExternalLink size={14} aria-hidden="true" />LinkedIn</a></li>
              ) : null}
              {m.links.map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-link"><Link2 size={14} aria-hidden="true" />{l.label}</a></li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {!m.self ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/blong/networking" scroll={false} className="text-[13px] font-bold text-link">All members</Link>
          <span className="flex gap-1"><MemberSafety id={m.id} name={m.name} /></span>
        </div>
      ) : null}
    </div>
  );
}
