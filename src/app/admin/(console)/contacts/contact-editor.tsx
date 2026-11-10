"use client";

import { EditorDrawer, useRunner } from "@/components/admin/crud";
import { SelectField, TextField } from "@/components/ui/field";
import type { Contact, Space } from "@/lib/contacts/queries";
import { saveContact } from "./actions";

const SPACES: Space[] = ["Outloud", "TVS", "BRICKR", "QuidQuo"];
const CONSENT = ["Email, WhatsApp, push", "Email, WhatsApp", "Email", "WhatsApp", "Not asked yet"];

/** Add a contact, or edit one the partners added (members are edited with "Edit details"). */
export function ContactEditor({ open, contact, onClose, onSaved }: { open: boolean; contact: Contact | null; onClose: () => void; onSaved?: () => void }) {
  const r = useRunner();
  const e = contact;
  return (
    <EditorDrawer
      open={open}
      onClose={onClose}
      eyebrow="Contacts"
      title={e ? "Edit contact" : "Add contact"}
      pending={r.pending}
      error={r.error}
      formKey={e?.key ?? "new"}
      onSubmit={(fd) => r.run(() => saveContact(fd), () => { onClose(); onSaved?.(); })}
    >
      {e?.contactId ? <input type="hidden" name="id" value={e.contactId} /> : null}
      <TextField label="Full name" name="name" defaultValue={e?.name ?? ""} required maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Email" name="email" type="email" defaultValue={e?.email ?? ""} maxLength={200} />
        <TextField label="Mobile" name="phone" type="tel" defaultValue={e?.phone ?? ""} maxLength={40} placeholder="+20 …" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Company" name="company" defaultValue={e?.company ?? ""} maxLength={120} />
        <TextField label="Role · stage" name="role" defaultValue={e?.role ?? ""} maxLength={80} />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1 text-[12.5px] font-bold text-muted">Spaces</legend>
        <div className="flex flex-wrap gap-3">
          {SPACES.map((s) => (
            <label key={s} className="flex min-h-10 items-center gap-1.5 text-[13.5px]">
              <input type="checkbox" name="tags" value={s} defaultChecked={e?.adminTags.includes(s)} className="h-4 w-4 accent-primary" />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <SelectField label="Consent" name="consent" defaultValue={e?.consent ?? "Not asked yet"} options={CONSENT} hint="What they agreed to be contacted by." />
    </EditorDrawer>
  );
}
