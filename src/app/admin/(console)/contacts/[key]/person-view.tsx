"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Ban, KeyRound, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { ConfirmDelete, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Drawer, Modal } from "@/components/ui/overlay";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { AboutForm, type AboutInitial } from "@/app/(auth)/welcome/about-form";
import { formatDateTime } from "@/lib/events/format";
import { relativeWhen } from "@/lib/content/format";
import type { Contact, Space } from "@/lib/contacts/queries";
import { filterTimeline, TIMELINE_FILTERS, type TimelineFilter, type TimelineItem } from "@/lib/contacts/timeline";
import { deleteContact, saveNote, sendPasswordReset, setSuspension, updateMember } from "../actions";
import { ContactEditor } from "../contact-editor";

const SPACES: Space[] = ["Outloud", "TVS", "BRICKR", "QuidQuo"];

type MemberControls = { id: string; email: string; suspended: boolean; initial: AboutInitial };

/** Edit details, password reset and suspension for members; edit and delete for added contacts. */
export function PersonActions({ contact, member, base }: { contact: Contact; member: MemberControls | null; base: string }) {
  const router = useRouter();
  const r = useRunner();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const saved = useCallback(() => {
    setEditing(false);
    router.refresh();
  }, [router]);

  if (!member) {
    if (!contact.contactId || contact.memberId) return null;
    return (
      <>
        <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden="true" />Edit contact</Button>
        <Button variant="danger" onClick={() => setDeleting(true)}><Trash2 size={15} aria-hidden="true" />Delete</Button>
        <ContactEditor open={editing} contact={contact} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />
        <ConfirmDelete
          name={contact.name}
          open={deleting}
          onClose={() => setDeleting(false)}
          pending={r.pending}
          note="Their note is deleted too. This doesn't affect member accounts."
          onConfirm={() => r.run(() => deleteContact(contact.contactId!), () => router.push(`${base}/contacts`))}
        />
      </>
    );
  }

  const save = updateMember.bind(null, member.id);
  return (
    <>
      <Button onClick={() => setEditing(true)}><Pencil size={15} aria-hidden="true" />Edit details</Button>
      <Button variant="secondary" onClick={() => setResetting(true)}><KeyRound size={15} aria-hidden="true" />Send password reset</Button>
      {member.suspended ? (
        <Button variant="secondary" disabled={r.pending} onClick={() => r.run(() => setSuspension(member.id, false), () => router.refresh())}>
          <ShieldCheck size={15} aria-hidden="true" />Lift suspension
        </Button>
      ) : (
        <Button variant="danger" onClick={() => setSuspending(true)}><Ban size={15} aria-hidden="true" />Suspend</Button>
      )}

      <Drawer open={editing} onClose={() => setEditing(false)} eyebrow="Contacts" title={`Edit ${contact.name}`} wide>
        <div className="flex flex-col gap-3">
          <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-soft-fg">The member is told in their notifications when you save. Changes are recorded in Activity.</p>
          <AboutForm key={editing ? "open" : "closed"} initial={member.initial} returning inProfile byAdmin save={save} onSaved={saved} />
        </div>
      </Drawer>

      <Modal
        open={resetting}
        onClose={() => setResetting(false)}
        title="Send a password reset?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetting(false)}>Cancel</Button>
            <Button disabled={r.pending} onClick={() => r.run(() => sendPasswordReset(member.id), () => { setResetting(false); router.refresh(); })}>
              {r.pending ? "Sending…" : "Send reset link"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px]">
          We&apos;ll email <b>{member.email}</b> a link to choose a new password. It works for 2 hours. Their current password keeps working until they change it, and nobody else sees the new one.
        </p>
      </Modal>

      <Modal
        open={suspending}
        onClose={() => setSuspending(false)}
        title={`Suspend ${contact.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspending(false)}>Cancel</Button>
            <Button variant="danger" disabled={r.pending} onClick={() => r.run(() => setSuspension(member.id, true, reason), () => { setSuspending(false); setReason(""); router.refresh(); })}>
              {r.pending ? "Suspending…" : "Suspend account"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[13.5px]">
          <p>They&apos;re signed out on every device and can&apos;t sign in until you lift the suspension. Their bookings, payments and history stay as they are. You can lift it any time.</p>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-muted">
            Reason (partners only)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Why the account is suspended" className="resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] font-normal text-fg placeholder:text-faint focus:border-primary focus:outline-none" />
          </label>
        </div>
      </Modal>
    </>
  );
}

/** The partners' private note and space tags. */
export function NotesCard({ contact: c, readOnly = false }: { contact: Contact; readOnly?: boolean }) {
  const [note, setNote] = useState(c.note);
  const [tags, setTags] = useState<Space[]>(c.adminTags);
  const r = useRunner();
  const router = useRouter();
  if (!c.memberId && !c.contactId) {
    return (
      <Card>
        <CardHeader title="Notes" />
        <span className="text-[13px] text-faint">Added from the QuidQuo waitlist. Add them as a contact to keep notes.</span>
      </Card>
    );
  }
  if (readOnly) {
    return (
      <Card className="gap-3">
        <CardHeader title="Notes and tags" action={<span className="font-normal text-faint">View only</span>} />
        <p className="text-[13.5px] whitespace-pre-line text-muted">{c.note || "No note yet."}</p>
        {c.adminTags.length ? <div className="flex flex-wrap gap-1">{c.adminTags.map((t) => <ThreadTag key={t} thread={t} />)}</div> : null}
      </Card>
    );
  }
  return (
    <Card className="gap-3">
      <CardHeader title="Notes and tags" action={<span className="font-normal text-faint">Team only</span>} />
      <label className="sr-only" htmlFor="note">Private note</label>
      <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={4000} placeholder="Visible to partners only" className="resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] text-fg placeholder:text-faint focus:border-primary focus:outline-none" />
      {c.memberId ? (
        <div className="flex flex-wrap gap-3">
          {SPACES.map((s) => (
            <label key={s} className="flex min-h-9 items-center gap-1.5 text-[13px]">
              <input type="checkbox" checked={tags.includes(s)} onChange={(e) => setTags(e.target.checked ? [...tags, s] : tags.filter((t) => t !== s))} className="h-4 w-4 accent-primary" />
              {s}
            </label>
          ))}
        </div>
      ) : null}
      <Button size="sm" className="self-start" disabled={r.pending} onClick={() => r.run(() => saveNote({ memberId: c.memberId, contactId: c.contactId }, note, c.memberId ? tags : c.adminTags), () => router.refresh())}>
        Save note
      </Button>
    </Card>
  );
}

const tone = (s: string) => (/won|enrolled|confirmed|joined|paid|picked|reviewed/i.test(s) ? "ok" : /declined|cancelled|expired|refunded|hidden/i.test(s) ? "draft" : "blue");

/** Activity tab: everything the person did, and what partners did on their account, newest first. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const [f, setF] = useState<TimelineFilter>("All");
  const shown = filterTimeline(items, f);
  return (
    <Card className="gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter activity">
        {TIMELINE_FILTERS.map((x) => (
          <Chip key={x} pressed={f === x} onClick={() => setF(x)}>{x}</Chip>
        ))}
      </div>
      {shown.length ? (
        <ol className="relative flex flex-col pl-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line2">
          {shown.map((t) => (
            <li key={t.key} className="relative flex flex-col gap-0.5 py-2.5">
              <i className={`absolute top-[15px] -left-[19px] h-2.5 w-2.5 rounded-full ring-4 ring-card ${t.by ? "bg-[#F2C27A]" : "bg-primary"}`} aria-hidden="true" />
              <span className="flex flex-wrap items-center gap-1.5">
                <b className="text-[13.5px]">{t.title}</b>
                {t.status ? <StatusPill tone={tone(t.status)}>{t.status.charAt(0).toUpperCase() + t.status.slice(1)}</StatusPill> : null}
                {t.space !== "House" ? <ThreadTag thread={t.space} /> : null}
              </span>
              {t.detail ? <span className="text-[13px] text-muted">{t.detail}</span> : null}
              <span className="text-[12px] text-faint" title={formatDateTime(t.at)}>{formatDateTime(t.at)} · {relativeWhen(t.at)}{t.by ? ` · by ${t.by}` : ""}</span>
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-[13px] text-faint">Nothing here for this filter.</span>
      )}
    </Card>
  );
}
