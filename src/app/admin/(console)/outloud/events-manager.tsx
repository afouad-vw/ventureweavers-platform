"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Pencil, Plus, Trash2, Users } from "lucide-react";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Drawer, Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { EVENT_TYPES, formatDateTime, formatEGP, isoToCairoLocal, MASTERCLASS_FORMATS, typeLabel } from "@/lib/events/format";
import type { AdminEvent } from "@/lib/events/admin-queries";
import { deleteEvent, duplicateEvent, saveEvent, setEventStatus, type ActionResult } from "./actions";
import { ImageField } from "@/components/admin/image-field";

const priceInput = (p: number | null) => (p == null ? "" : (p / 100).toString());

/** Admin › Outloud › Events: table with create, edit, duplicate, delete and Published/Draft. */
export function EventsManager({ events, base, mode = "outloud" }: { events: AdminEvent[]; base: string; mode?: "outloud" | "masterclasses" }) {
  const mc = mode === "masterclasses";
  const [editing, setEditing] = useState<AdminEvent | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(r.message ?? "Done");
        setError(null);
        after?.();
      } else {
        setError(r.error);
        toast(r.error);
      }
    });

  const e = editing && editing !== "new" ? editing : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-faint">{events.length} {mc ? "masterclasses" : "events"}</span>
        <Button onClick={() => { setError(null); setEditing("new"); }}>
          <Plus size={15} aria-hidden="true" />
          {mc ? "New masterclass" : "New event"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] font-extrabold tracking-wide text-faint uppercase">
            <tr>
              <th className="px-3 py-2.5">Event</th>
              <th className="px-3 py-2.5">When</th>
              <th className="px-3 py-2.5">Seats</th>
              <th className="px-3 py-2.5">Price</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2.5">
                  <b className="block">{ev.title}</b>
                  <span className="text-faint">{ev.type === "masterclass" ? ev.format ?? "Online" : typeLabel(ev.type)} · {ev.venue ?? "[VENUE]"}</span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.starts_at ? formatDateTime(ev.starts_at) : "By request"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {ev.type === "private_session" ? "—" : (
                    <>
                      <b>{ev.confirmed}</b> paid
                      {ev.reserved ? <span className="text-faint"> · {ev.reserved} reserved</span> : null}
                      <span className="text-faint"> / {ev.capacity}</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.type === "private_session" ? "On request" : formatEGP(ev.price_piasters)}</td>
                <td className="px-3 py-2.5"><StatusPill tone={ev.status === "published" ? "ok" : "draft"}>{ev.status === "published" ? "Published" : "Draft"}</StatusPill></td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    {mode === "outloud" && ev.type === "public_show" ? (
                      <Link href={`${base}/outloud?tab=live&event=${ev.id}`} className="inline-flex h-8 items-center rounded-md px-2 text-[12.5px] font-bold text-fg hover:bg-hover">Run live</Link>
                    ) : null}
                    {ev.type !== "private_session" ? (
                      <Link href={`${base}/outloud/events/${ev.id}`} title="Bookings" aria-label={`Bookings for ${ev.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg hover:bg-hover"><Users size={15} aria-hidden="true" /></Link>
                    ) : null}
                    <IconBtn label={`Edit ${ev.title}`} onClick={() => { setError(null); setEditing(ev); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                    <IconBtn label={`Duplicate ${ev.title}`} onClick={() => run(() => duplicateEvent(ev.id))}><Copy size={15} aria-hidden="true" /></IconBtn>
                    <IconBtn label={ev.status === "published" ? `Unpublish ${ev.title}` : `Publish ${ev.title}`} onClick={() => run(() => setEventStatus(ev.id, ev.status === "published" ? "draft" : "published"))}>
                      {ev.status === "published" ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    </IconBtn>
                    <IconBtn label={`Delete ${ev.title}`} onClick={() => setConfirmDelete(ev)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {!events.length ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-faint">No events yet. Create the first one.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="Outloud · Events"
        title={mc ? (e ? "Edit masterclass" : "New masterclass") : e ? "Edit event" : "New event"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={pending} onClick={() => formRef.current?.requestSubmit()}>{pending ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        {editing !== null ? (
          <form
            key={e?.id ?? "new"}
            ref={formRef}
            className="flex flex-col gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              run(() => saveEvent(fd), () => setEditing(null));
            }}
          >
            {e ? <input type="hidden" name="id" value={e.id} /> : null}
            <TextField label="Title" name="title" defaultValue={e?.title ?? ""} required minLength={3} maxLength={140} />
            <div className="grid grid-cols-2 gap-3">
              {mc ? (
                <>
                  <input type="hidden" name="type" value="masterclass" />
                  <SelectField label="Format" name="format" defaultValue={e?.format ?? "Online"} options={MASTERCLASS_FORMATS} />
                </>
              ) : (
                <SelectField label="Type" name="type" defaultValue={e?.type ?? "public_show"} options={EVENT_TYPES} />
              )}
              <SelectField label="Status" name="status" defaultValue={e?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
            </div>
            <TextField label="Date and time (Cairo)" name="starts_at" type="datetime-local" defaultValue={e?.starts_at ? isoToCairoLocal(e.starts_at) : ""} hint={mc ? undefined : "Leave empty for private sessions."} />
            <TextField label="Venue" name="venue" defaultValue={e?.venue ?? (mc ? "Online" : "")} placeholder="[VENUE], Cairo" maxLength={160} />
            {mc ? (
              <TextField label="Google Meet link" name="meet_url" type="url" defaultValue={e?.meet_url ?? ""} placeholder="https://meet.google.com/…" hint="Shown only to members with a confirmed ticket. Create it in Google Calendar and paste it here." />
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Capacity" name="capacity" type="number" min={0} max={10000} defaultValue={e?.capacity ?? (mc ? 40 : 80)} />
              <TextField label="Price per seat (EGP)" name="price" inputMode="decimal" defaultValue={priceInput(e?.price_piasters ?? null)} placeholder="Empty = [PRICE]" hint="Booking opens once a price is set." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label={mc ? "Host" : "Hosts"} name="hosts" defaultValue={e?.hosts ?? "Fouad & Karim"} maxLength={160} />
              <TextField label="Guest" name="guest" defaultValue={e?.guest ?? ""} placeholder="[GUEST NAME]" maxLength={160} />
            </div>
            <ImageField name="banner_url" target="event-banners" initial={e?.banner_url ?? null} />
            <SelectField label="Photo or pattern (used when no image is uploaded)" name="banner" defaultValue={e?.banner ?? "Stage"} options={BANNER_OPTIONS} />
            <TextArea label="Description" name="description" rows={5} defaultValue={e?.description ?? ""} maxLength={4000} />
            {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
          </form>
        ) : null}
      </Drawer>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this event?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button variant="danger" disabled={pending} onClick={() => confirmDelete && run(() => deleteEvent(confirmDelete.id), () => setConfirmDelete(null))}>Delete</Button>
          </>
        }
      >
        <p className="text-[13.5px]"><b>{confirmDelete?.title}</b> will be removed. Events with bookings can&apos;t be deleted; set them to Draft instead.</p>
      </Modal>
    </>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg hover:bg-hover">
      {children}
    </button>
  );
}
