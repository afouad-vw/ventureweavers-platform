import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Linkedin, Mail, MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { relativeWhen } from "@/lib/content/format";
import { loadPerson } from "@/lib/contacts/person";
import { formatDate, formatDateTime, formatEGP } from "@/lib/events/format";
import { initialsOf } from "@/lib/initials";
import { KIND_LABEL, statusLabel, statusTone, totals } from "@/lib/payments/format";
import { splitPhone } from "@/lib/profile/about";
import { waNumber } from "../wa";
import { NotesCard, PersonActions, Timeline } from "./person-view";

export const metadata: Metadata = { title: "Contact" };

const TABS = ["overview", "activity", "payments"] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="w-[180px] shrink-0 text-[12.5px] font-bold text-faint">{label}</dt>
      <dd className="min-w-0 text-[13.5px] break-words">{children ?? "—"}</dd>
    </div>
  );
}

export default async function ContactPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const [{ key }, { tab: rawTab }, base] = await Promise.all([params, searchParams, currentAdminBase()]);
  const person = await loadPerson(key);
  if (!person) notFound();
  const { contact: c, account: a, timeline, payments } = person;
  const tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as (typeof TABS)[number]) : "overview";
  const wa = waNumber(c.phone);
  const here = `${base}/contacts/${key}`;
  const sums = totals(payments);

  return (
    <>
      <Link href={`${base}/contacts`} className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        Contacts
      </Link>

      <Card className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[20px] font-bold text-white">{initialsOf(c.name)}</span>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-display text-[22px] leading-tight font-semibold">{c.name}</h1>
              <span className="text-[13px] text-muted">
                {c.memberId ? "Member" : "Added contact"}
                {c.role ? ` · ${c.role}` : ""} · joined {formatDate(c.joinedAt)}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {a?.suspended ? <StatusPill tone="bad">Suspended</StatusPill> : null}
                {c.spaces.map((s) => <ThreadTag key={s} thread={s} />)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {c.email ? <a href={`mailto:${c.email}`} className={buttonClass("secondary")}><Mail size={15} aria-hidden="true" />Email</a> : null}
            {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}><MessageCircle size={15} aria-hidden="true" />WhatsApp</a> : null}
            <PersonActions
              contact={c}
              base={base}
              member={
                a && c.memberId && !a.isAdmin
                  ? {
                      id: c.memberId,
                      email: c.email ?? "",
                      suspended: Boolean(a.suspended),
                      initial: {
                        name: a.edit.name,
                        email: c.email ?? "",
                        dialCountry: splitPhone(a.edit.phone).dialCountry,
                        phone: splitPhone(a.edit.phone).number,
                        linkedin: a.edit.linkedin ?? "",
                        country: a.edit.country ?? "",
                        role: a.edit.role ?? "",
                        interests: a.edit.goals,
                        contact: a.edit.contact,
                        newsletter: a.newsletter,
                      },
                    }
                  : null
              }
            />
          </div>
        </div>
        {a?.suspended ? (
          <p className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad-fg">
            <b>Suspended</b> by {a.suspended.by} on {formatDateTime(a.suspended.at)}{a.suspended.reason ? ` · ${a.suspended.reason}` : ""}. They can&apos;t sign in until the suspension is lifted.
          </p>
        ) : null}
      </Card>

      <LinkTabs
        label="Contact sections"
        value={tab}
        hrefFor={(v) => (v === "overview" ? here : `${here}?tab=${v}`)}
        items={[
          { value: "overview", label: "Overview" },
          { value: "activity", label: "Activity", count: timeline.length },
          ...(c.memberId ? [{ value: "payments", label: "Payments", count: payments.length }] : []),
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_340px] desk:gap-[18px]">
          <Card>
            <CardHeader title="Details" />
            <dl className="flex flex-col">
              <Row label="Email">{c.email}</Row>
              <Row label="Mobile">{c.phone}</Row>
              {c.memberId ? <Row label="Country">{c.country}</Row> : <Row label="Company">{c.company}</Row>}
              <Row label="Role">{c.role}</Row>
              {c.memberId ? (
                <Row label="LinkedIn">
                  {c.linkedin ? <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-link hover:underline"><Linkedin size={14} aria-hidden="true" />Profile</a> : null}
                </Row>
              ) : null}
              {c.memberId ? <Row label="Interests">{c.interests.length ? c.interests.join(", ") : null}</Row> : null}
              <Row label={c.memberId ? "How we communicate" : "Consent"}>{c.consent}</Row>
              {a ? <Row label="Newsletter">{a.newsletter ? "Subscribed" : "Not subscribed"}</Row> : null}
              <Row label="How they joined">{c.source}</Row>
              {a ? <Row label="Signs in with">{a.provider}{a.emailConfirmed ? "" : " · email not confirmed yet"}</Row> : null}
              {a ? <Row label="Last sign-in">{a.lastSignIn ? `${formatDateTime(a.lastSignIn)} (${relativeWhen(a.lastSignIn)})` : "Never"}</Row> : null}
            </dl>
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            <NotesCard contact={c} />
            <Card>
              <CardHeader title="Latest activity" action={<Link href={`${here}?tab=activity`} className="text-link">See all</Link>} />
              {timeline.length ? (
                <ul className="flex flex-col">
                  {timeline.slice(0, 5).map((t) => (
                    <li key={t.key} className="flex flex-col border-b border-line py-2 last:border-b-0">
                      <span className="text-[13.5px] font-bold">{t.title}</span>
                      <span className="text-[12px] text-faint">{relativeWhen(t.at)}{t.by ? ` · by ${t.by}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[13px] text-faint">Nothing yet.</span>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "activity" ? <Timeline items={timeline} /> : null}

      {tab === "payments" ? (
        payments.length ? (
          <Card>
            <CardHeader title="Payments" action={<span className="font-normal text-faint">Paid {formatEGP(sums.collected)} · pending {formatEGP(sums.pending)}</span>} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead><tr className="border-b border-line text-left text-[12px] text-faint">{["Item", "Type", "Amount", "Status", "Reference", "Date"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={`${p.kind}${p.id}`} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2.5 font-bold">{p.item}</td>
                      <td className="px-3 py-2.5 text-muted">{KIND_LABEL[p.kind]}</td>
                      <td className="px-3 py-2.5">{formatEGP(p.amount_piasters)}</td>
                      <td className="px-3 py-2.5"><StatusPill tone={statusTone(p.status)}>{statusLabel(p.status)}</StatusPill></td>
                      <td className="px-3 py-2.5 font-mono text-[12.5px] text-muted">{p.reference}</td>
                      <td className="px-3 py-2.5 text-muted">{formatDate(p.paid_at ?? p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href={`${base}/payments?q=${encodeURIComponent(c.email ?? c.name)}`} className="self-start text-[13px] font-bold text-link hover:underline">Open in Payments</Link>
          </Card>
        ) : (
          <EmptyState>No payments yet.</EmptyState>
        )
      ) : null}
    </>
  );
}
