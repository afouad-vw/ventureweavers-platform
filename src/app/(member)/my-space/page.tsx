import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState, TicketQR } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { initialsOf } from "@/components/shell/shells";
import { requireMember } from "@/lib/auth/guards";
import { bookingBadge, formatDateTime, formatEGP } from "@/lib/events/format";
import { myBookings, paymentInstructions, type MyBooking } from "@/lib/events/queries";
import { createClient } from "@/lib/supabase/server";
import { CancelReservation } from "./cancel-button";
import { ProfileForm, type ProfileValues } from "./profile-form";

export const metadata: Metadata = { title: "My space" };

export default async function MySpacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const member = await requireMember("/my-space");
  const { tab: raw } = await searchParams;
  const supabase = await createClient();
  const [{ data: p }, bookings, { count: savedCount }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, role, stage, goals, interests, consent_whatsapp, consent_push, consent_newsletter").eq("id", member.id).maybeSingle(),
    myBookings(),
    supabase.from("saved_items").select("item_id", { count: "exact", head: true }),
  ]);
  const active = bookings.filter((b) => ["reserved", "confirmed"].includes(b.status));
  const tabs = [
    { value: "tickets", label: "Tickets", count: active.length },
    { value: "learning", label: "Learning" },
    { value: "requests", label: "Requests" },
    { value: "saved", label: "Saved", count: savedCount ?? 0 },
    { value: "profile", label: "Profile & settings" },
  ];
  const tab = tabs.some((t) => t.value === raw) ? raw! : "tickets";
  const name = p?.full_name || member.email || "Member";

  return (
    <>
      <Card className="sm:flex-row sm:items-center">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-white">{initialsOf(name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold">{name}</h1>
          <span className="text-[13px] text-faint">{[p?.role, p?.stage, "Cairo"].filter(Boolean).join(" · ")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <ThreadTag thread="Outloud" label="Outloud member" />
          </div>
        </div>
        <LinkButton href="/my-space?tab=profile" variant="secondary" scroll={false}>Edit profile</LinkButton>
      </Card>
      <LinkTabs label="My space sections" items={tabs} value={tab} hrefFor={(v) => (v === "tickets" ? "/my-space" : `/my-space?tab=${v}`)} />

      {tab === "tickets" ? <Tickets bookings={bookings} /> : null}
      {tab === "learning" ? <EmptyState>Your programs and masterclasses appear here. <Link className="font-bold text-link" href="/tvs">Explore TVS</Link></EmptyState> : null}
      {tab === "requests" ? <EmptyState>Your meeting requests appear here. <Link className="font-bold text-link" href="/brickr">Book a conversation</Link></EmptyState> : null}
      {tab === "saved" ? <EmptyState>Save posts, articles and resources to find them here.</EmptyState> : null}
      {tab === "profile" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader title="Profile" />
            <ProfileForm
              initial={{
                full_name: p?.full_name ?? "",
                phone: p?.phone ?? "",
                role: p?.role ?? "",
                stage: p?.stage ?? "",
                goals: (p?.goals as string[]) ?? [],
                interests: (p?.interests as string[]) ?? [],
                consent_whatsapp: !!p?.consent_whatsapp,
                consent_push: !!p?.consent_push,
                consent_newsletter: !!p?.consent_newsletter,
              } satisfies ProfileValues}
            />
          </Card>
          <Card>
            <CardHeader title="Account" />
            <p className="text-[13px] text-faint">Signed in as</p>
            <p className="-mt-1.5 text-[13.5px] font-bold break-all">{member.email}</p>
            <Link href="/reset-password" className={buttonClass("secondary", "md", "self-start")}>Change password</Link>
            <p className="text-[12.5px] text-faint">
              Want your account and data deleted? Email{" "}
              <a className="font-bold text-link" href="mailto:info@ventureweavers.com?subject=Delete%20my%20account">info@ventureweavers.com</a> and we&apos;ll do it within 7 days.
            </p>
          </Card>
        </div>
      ) : null}
    </>
  );
}

async function Tickets({ bookings }: { bookings: MyBooking[] }) {
  if (!bookings.length) {
    return (
      <EmptyState>
        No tickets yet. <Link className="font-bold text-link" href="/outloud">Find a show</Link>
      </EmptyState>
    );
  }
  const pay = await paymentInstructions();
  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => {
        const e = b.events;
        const badge = bookingBadge({ status: b.status, hold_expires_at: b.hold_expires_at, checked_in_at: b.tickets?.checked_in_at });
        const live = ["Awaiting payment", "Confirmed", "Checked in"].includes(badge.label);
        return (
          <Card key={b.id} as="article" className="overflow-hidden !p-0 !gap-0 sm:flex-row">
            <div className="flex flex-[999_1_280px] flex-col gap-2.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <ThreadTag thread="Outloud" />
                <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
              </div>
              <h3 className="text-base font-extrabold">
                {e ? <Link href={`/outloud/events/${e.slug}`} className="hover:underline">{e.title}</Link> : "Event"}
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-4">
                <div><dt className="text-[11.5px] text-faint">When</dt><dd className="font-bold">{e?.starts_at ? formatDateTime(e.starts_at) : "—"}</dd></div>
                <div><dt className="text-[11.5px] text-faint">Where</dt><dd className="font-bold">{e?.venue ?? "[VENUE]"}</dd></div>
                <div><dt className="text-[11.5px] text-faint">Seats</dt><dd className="font-bold">{b.seats}</dd></div>
                <div><dt className="text-[11.5px] text-faint">Total</dt><dd className="font-bold">{formatEGP(b.amount_piasters)}</dd></div>
              </dl>
              {badge.label === "Awaiting payment" ? (
                <div className="flex flex-col gap-1.5 rounded-lg bg-warn-bg p-3 text-[13px] text-warn-fg">
                  <span>
                    Transfer <b>{formatEGP(b.amount_piasters)}</b>
                    {b.hold_expires_at ? <> before <b>{formatDateTime(b.hold_expires_at)}</b></> : null} with the reference <b className="font-display tracking-wide">{b.pay_reference}</b>.
                  </span>
                  <span className="whitespace-pre-line text-fg">{pay.bank_details || "[BANK DETAILS]"}</span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {live && e?.starts_at && b.tickets ? (
                  <a href={`/api/tickets/${b.tickets.code}/calendar`} className={buttonClass("secondary")}>
                    <CalendarPlus size={15} aria-hidden="true" />
                    Add to calendar
                  </a>
                ) : null}
                {badge.label === "Awaiting payment" && e ? <CancelReservation bookingId={b.id} title={e.title} /> : null}
              </div>
            </div>
            {live && b.tickets ? (
              <div className="flex flex-[1_1_200px] flex-col items-center justify-center gap-1.5 border-t border-dashed border-line2 bg-white p-4 text-ink sm:border-t-0 sm:border-l">
                <TicketQR value={b.tickets.code} size={140} />
                <b className="font-display tracking-[2px]">{b.tickets.code}</b>
                <span className="text-xs text-[#3E4E4C]">{badge.label === "Awaiting payment" ? "Valid once paid" : "Scan at the door"}</span>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
