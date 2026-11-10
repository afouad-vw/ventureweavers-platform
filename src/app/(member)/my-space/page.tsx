import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Radio, Video } from "lucide-react";
import { myLiveShows } from "@/lib/live/queries";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState, TicketQR } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { initialsOf } from "@/lib/initials";
import { requireMember } from "@/lib/auth/guards";
import { bookingBadge, formatDate, formatDateTime, formatEGP } from "@/lib/events/format";
import { myBookings, myMeetLinks, paymentInstructions, type MyBooking } from "@/lib/events/queries";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight } from "lucide-react";
import { SaveButton } from "@/components/content/member-buttons";
import { mySavedEntries } from "@/lib/content/queries";
import { applicationLabel, enrolmentLabel } from "@/lib/tvs/format";
import { myTvs } from "@/lib/tvs/queries";
import { myRequests } from "@/lib/brickr/queries";
import { KIND_LABEL, statusLabel as payLabel, statusTone as payTone } from "@/lib/payments/format";
import { myPayments, type MyPayment } from "@/lib/payments/queries";
import { WithdrawButton } from "@/components/brickr/brickr-client";
import { CancelReservation } from "./cancel-button";
import { ProfileForm, type ProfileValues } from "./profile-form";

export const metadata: Metadata = { title: "My space" };

export default async function MySpacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const member = await requireMember("/my-space");
  const { tab: raw } = await searchParams;
  const supabase = await createClient();
  const [{ data: p }, bookings, { count: savedCount }, payments] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, role, stage, goals, interests, consent_whatsapp, consent_push, consent_newsletter").eq("id", member.id).maybeSingle(),
    myBookings(),
    supabase.from("saved_items").select("item_id", { count: "exact", head: true }),
    myPayments(),
  ]);
  const owed = payments.filter((x) => x.status === "pending").length;
  const active = bookings.filter((b) => ["reserved", "confirmed"].includes(b.status));
  const tabs = [
    { value: "tickets", label: "Tickets", count: active.length },
    { value: "learning", label: "Learning" },
    { value: "requests", label: "Requests" },
    { value: "payments", label: "Payments", count: owed || null },
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
      {tab === "learning" ? <Learning /> : null}
      {tab === "requests" ? <Requests /> : null}
      {tab === "payments" ? <Payments payments={payments} /> : null}
      {tab === "saved" ? <Saved /> : null}
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
  const [pay, meet, liveNow] = await Promise.all([paymentInstructions(), myMeetLinks(), myLiveShows().catch(() => [])]);
  const liveIds = new Set(liveNow.map((l) => l.eventId));
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
                <ThreadTag thread={e?.type === "masterclass" ? "TVS" : "Outloud"} />
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
                {e && liveIds.has(e.id) && b.status === "confirmed" ? (
                  <Link href={`/live?event=${e.id}`} className={buttonClass("primary")}>
                    <Radio size={15} aria-hidden="true" />
                    Open live mode
                  </Link>
                ) : null}
                {live && e?.starts_at && b.tickets ? (
                  <a href={`/api/tickets/${b.tickets.code}/calendar`} className={buttonClass("secondary")}>
                    <CalendarPlus size={15} aria-hidden="true" />
                    Add to calendar
                  </a>
                ) : null}
                {e && meet.get(e.id) && badge.label === "Confirmed" ? (
                  <a href={meet.get(e.id)} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
                    <Video size={15} aria-hidden="true" />
                    Join with Google Meet
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

async function Payments({ payments }: { payments: MyPayment[] }) {
  if (!payments.length) return <EmptyState>Your payments for seats, programs and services appear here.</EmptyState>;
  const pending = payments.filter((x) => x.status === "pending");
  const pay = pending.length ? await paymentInstructions() : null;
  return (
    <div className="flex flex-col gap-4">
      {pending.length && pay ? (
        <Card tone="soft">
          <CardHeader title="How to pay" />
          <p className="text-[13.5px]">Pay by bank transfer and use the reference shown next to each item, so we can match it. We email a receipt once it arrives.</p>
          <p className="rounded-lg bg-card p-3 text-[13.5px] whitespace-pre-line">{pay.bank_details || "[BANK DETAILS]"}</p>
          <p className="text-[12.5px] text-faint">Refunds: {pay.refund_policy || "[REFUND POLICY]"}</p>
        </Card>
      ) : null}
      <div className="overflow-x-auto glass rounded-2xl border">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] font-extrabold tracking-wide text-faint uppercase">
            <tr><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5">Amount</th><th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Date</th></tr>
          </thead>
          <tbody>
            {payments.map((x) => (
              <tr key={`${x.kind}:${x.id}`} className="border-b border-line align-top last:border-b-0">
                <td className="px-3 py-2.5">
                  <b>{x.item}</b>
                  <span className="block text-[12px] text-faint">{KIND_LABEL[x.kind]}{x.due_on && x.status === "pending" ? ` · due ${formatDate(x.due_on)}` : ""}{x.kind === "seat" && x.status === "pending" && x.hold_expires_at ? ` · pay before ${formatDateTime(x.hold_expires_at)}` : ""}</span>
                  {x.note ? <span className="mt-1 block text-[12.5px] whitespace-pre-line text-muted">{x.note}</span> : null}
                </td>
                <td className="px-3 py-2.5 font-bold whitespace-nowrap">{formatEGP(x.amount_piasters)}</td>
                <td className="px-3 py-2.5 font-display tracking-wide">{x.reference}</td>
                <td className="px-3 py-2.5"><StatusPill tone={payTone(x.status)}>{x.status === "pending" ? "To pay" : payLabel(x.status)}</StatusPill></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDate(x.paid_at ?? x.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function Saved() {
  const items = await mySavedEntries();
  if (!items.length) return <EmptyState>Save posts, articles and resources to find them here.</EmptyState>;
  return (
    <Card>
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={`${i.type}:${i.id}`} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
            <span className="w-[110px] shrink-0 truncate text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">{i.label}</span>
            <Link href={i.href} className="min-w-0 flex-1 truncate text-[14px] font-bold hover:underline">{i.title}</Link>
            <SaveButton type={i.type} id={i.id} saved signedIn compact />
            <Link href={i.href} aria-label={`Open ${i.title}`} className="text-faint hover:text-fg"><ArrowRight size={14} aria-hidden="true" /></Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function Learning() {
  const [{ applications, enrolments }, pay] = await Promise.all([myTvs(), paymentInstructions()]);
  const active = enrolments.filter((e) => e.status !== "cancelled");
  if (!applications.length && !active.length) {
    return (
      <EmptyState>
        Your programs and applications appear here. <Link className="font-bold text-link" href="/tvs">Explore TVS</Link> · Masterclass tickets are under{" "}
        <Link className="font-bold text-link" href="/my-space?tab=tickets">Tickets</Link>.
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {active.map((e) => (
        <Card key={e.id} tone={e.status === "offered" ? "soft" : undefined}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-extrabold">
              {e.cohorts?.programs?.name ?? "Program"} · {e.cohorts?.label ?? "Cohort [NO.]"}
            </h2>
            <StatusPill tone={e.status === "confirmed" ? "ok" : "warn"}>{enrolmentLabel(e.status)}</StatusPill>
          </div>
          {e.status === "offered" ? (
            <>
              <p className="text-[13.5px]">
                Your seat is waiting. To confirm it, transfer <b>{formatEGP(e.amount_piasters)}</b> by bank transfer with the reference <b className="font-mono">{e.pay_reference}</b>. We&apos;ll email you when the payment is confirmed.
              </p>
              <div className="rounded-lg bg-card p-3 text-[13px]">
                <span className="mb-1 block text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">Bank details</span>
                <span className="whitespace-pre-line text-fg">{pay.bank_details || "[BANK DETAILS]"}</span>
              </div>
            </>
          ) : (
            <p className="text-[13.5px] text-muted">
              You&apos;re enrolled{e.cohorts?.starts_on ? `; the cohort starts ${formatDate(e.cohorts.starts_on + "T12:00:00Z")}` : "; we'll share the start date [DATE]"}. The classroom opens before the first session.
            </p>
          )}
        </Card>
      ))}
      {applications.length ? (
        <Card>
          <CardHeader title="Applications" />
          <ul className="flex flex-col">
            {applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold">{a.programs?.name ?? "Program"}</div>
                  <span className="text-[12.5px] text-faint">Sent {formatDate(a.created_at)}</span>
                </div>
                <StatusPill tone={a.status === "won" ? "ok" : a.status === "declined" ? "draft" : "blue"}>{applicationLabel(a.status)}</StatusPill>
              </li>
            ))}
          </ul>
          <span className="text-[12.5px] text-faint">Next after applying: a short intro call, then an offer for a seat in the cohort.</span>
        </Card>
      ) : null}
    </div>
  );
}

async function Requests() {
  const [reqs, { applications }] = await Promise.all([myRequests(), myTvs()]);
  if (!reqs.length && !applications.length) {
    return (
      <EmptyState>
        Your meeting requests appear here. <Link className="font-bold text-link" href="/brickr">Book a conversation</Link>
      </EmptyState>
    );
  }
  return (
    <Card>
      <ul className="flex flex-col">
        {reqs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-3 border-b border-line py-3 last:border-b-0">
            <ThreadTag thread={r.space === "Outloud" ? "Outloud" : "BRICKR"} />
            <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
              <b className="text-[14px]">{r.services?.name ?? "Meeting request"}</b>
              {r.meeting_at ? (
                <span className="text-[13px]">
                  Confirmed for <b>{formatDateTime(r.meeting_at)}</b>
                  {r.meeting_url ? (
                    <>
                      {" · "}
                      <a href={r.meeting_url} target="_blank" rel="noopener noreferrer" className="font-bold text-link">Join on Google Meet</a>
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="text-[12.5px] text-faint">Asked for {formatDateTime(r.preferred_at)} · we confirm within 1–2 working days</span>
              )}
              {r.note ? <span className="text-[12.5px] text-muted">“{r.note}”</span> : null}
            </div>
            <StatusPill tone={r.status === "won" ? "ok" : r.status === "declined" ? "draft" : "blue"}>{applicationLabel(r.status)}</StatusPill>
            {r.status === "new" ? <WithdrawButton id={r.id} /> : null}
          </li>
        ))}
        {applications.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-b-0">
            <ThreadTag thread="TVS" />
            <div className="min-w-[200px] flex-1">
              <b className="text-[14px]">{a.programs?.name ?? "Program"} application</b>
              <span className="block text-[12.5px] text-faint">Sent {formatDate(a.created_at)} · details in <Link href="/my-space?tab=learning" className="font-bold text-link">My learning</Link></span>
            </div>
            <StatusPill tone={a.status === "won" ? "ok" : a.status === "declined" ? "draft" : "blue"}>{applicationLabel(a.status)}</StatusPill>
          </li>
        ))}
      </ul>
    </Card>
  );
}
