"use client";

import { useState, useTransition } from "react";
import { Bell, Download, Trash2, UserPlus } from "lucide-react";
import { IconBtn } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { addToWaitlist, removeFromWaitlist } from "@/app/admin/(console)/waitlist-actions";
import { formatDate } from "@/lib/events/format";
import { waitlistCsv, type WaitItemType, type WaitPerson } from "@/lib/waitlist";

/**
 * The bell with a count on an admin list row: opens the item's waitlist (who pressed Notify me),
 * with CSV export, add by email and remove. Shown when the item is Coming soon or anyone is on the list.
 */
export function WaitlistBadge({ type, id, title, people, comingSoon }: { type: WaitItemType; id: string; title: string; people: WaitPerson[]; comingSoon: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!comingSoon && !people.length) return null;
  const waiting = people.filter((p) => !p.notified).length;

  const download = () => {
    const blob = new Blob([waitlistCsv(title, people)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `waitlist-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <IconBtn label={`Waitlist: ${people.length} ${people.length === 1 ? "person" : "people"}`} onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-0.5 text-[11.5px] font-bold"><Bell size={13} aria-hidden="true" />{people.length}</span>
      </IconBtn>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Waitlist"
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={download} disabled={!people.length}><Download size={15} aria-hidden="true" />Export CSV</Button>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          {comingSoon
            ? `${waiting} waiting. When you set it to ${type === "program" ? "Open" : "Published"}, everyone waiting gets a bell notification and an email.`
            : "Everyone here has been told it's live."}
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addToWaitlist(type, id, email);
              toast(r.ok ? r.message : r.error);
              if (r.ok) setEmail("");
            });
          }}
        >
          <div className="min-w-0 flex-1">
            <TextField label="Add a member by email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" maxLength={200} />
          </div>
          <Button type="submit" variant="secondary" disabled={pending || !email.trim()}><UserPlus size={15} aria-hidden="true" />Add</Button>
        </form>
        {people.length ? (
          <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
            {people.map((p) => (
              <li key={p.member_id} className="flex items-center gap-2 border-b border-line py-2 text-[13.5px] last:border-b-0">
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{p.name}</b>
                  <span className="block truncate text-[12.5px] text-faint">{p.email ?? "No email"} · joined {formatDate(p.at)}{p.notified ? " · told" : ""}</span>
                </span>
                <IconBtn label={`Remove ${p.name}`} onClick={() => start(async () => { const r = await removeFromWaitlist(type, id, p.member_id); toast(r.ok ? r.message : r.error); })}>
                  <Trash2 size={15} aria-hidden="true" />
                </IconBtn>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-faint">Nobody yet. Members see a Notify me button while it&apos;s Coming soon.</p>
        )}
      </Modal>
    </>
  );
}
