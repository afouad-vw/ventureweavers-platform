"use client";

import { useActionState, useEffect, useState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, Toggle } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { CONTACT, INTEREST_HINT, INTERESTS } from "@/lib/profile/about";
import { COUNTRIES, MENA_COUNT } from "@/lib/profile/countries";
import { ROLES } from "@/lib/profile/options";
import type { FormState } from "@/lib/auth/form-state";
import { saveAbout } from "./actions";

export type AboutInitial = {
  name: string;
  email: string;
  dialCountry: string;
  phone: string;
  linkedin: string;
  country: string;
  role: string;
  interests: string[];
  contact: string[];
  newsletter: boolean;
};

const control =
  "h-11 rounded-lg border border-line2 bg-card/80 px-2.5 text-[14px] text-fg focus:border-primary focus:bg-card focus:shadow-glow focus:outline-none";

/** One short step after sign-up (and once for existing members): the details partners need to serve you. */
export function AboutForm({
  initial,
  next = "/",
  returning,
  save = saveAbout,
  inProfile = false,
  byAdmin = false,
  onSaved,
  children,
}: {
  initial: AboutInitial;
  next?: string;
  returning: boolean;
  save?: (s: FormState, f: FormData) => Promise<FormState>;
  inProfile?: boolean;
  /** A partner editing a member from Contacts: no newsletter choice, and the email stays the member's. */
  byAdmin?: boolean;
  onSaved?: () => void;
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(save, null);
  useEffect(() => {
    if (state?.message) onSaved?.();
  }, [state, onSaved]);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [contact, setContact] = useState<string[]>(initial.contact.length ? initial.contact : ["Email"]);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {interests.map((x) => <input key={x} type="hidden" name="interests" value={x} />)}
      {contact.map((x) => <input key={x} type="hidden" name="contact" value={x} />)}
      {inProfile ? null : (
        <div>
          <h1 className="font-display text-[24px] font-semibold">About you</h1>
          <p className="text-[13.5px] text-muted">{returning ? "We've added a few questions. It takes a minute." : "A few details so we can serve you well. It takes a minute."}</p>
        </div>
      )}

      <TextField label="Full name" name="name" defaultValue={initial.name} autoComplete="name" maxLength={120} required />

      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-bold text-muted">Mobile number</span>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="dial">Country code</label>
          <select id="dial" name="dial_country" defaultValue={initial.dialCountry} className={cn(control, "w-[132px] shrink-0")} autoComplete="tel-country-code">
            <optgroup label="MENA">
              {COUNTRIES.slice(0, MENA_COUNT).map((c) => <option key={c.code} value={c.code}>{c.dial} {c.name}</option>)}
            </optgroup>
            <optgroup label="Other countries">
              {COUNTRIES.slice(MENA_COUNT).map((c) => <option key={c.code} value={c.code}>{c.dial} {c.name}</option>)}
            </optgroup>
          </select>
          <label className="sr-only" htmlFor="phone">Number</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} placeholder="100 123 4567" autoComplete="tel-national" maxLength={20} required className={cn(control, "min-w-0 flex-1")} />
        </div>
      </div>

      <TextField label="Email" value={initial.email} readOnly disabled hint={byAdmin ? "Members change their own sign-in email." : "From your account."} />
      <TextField label="LinkedIn (optional)" name="linkedin" defaultValue={initial.linkedin} inputMode="url" placeholder="linkedin.com/in/your-name" maxLength={200} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Country"
          name="country"
          defaultValue={initial.country}
          required
          options={[{ value: "", label: "Choose your country" }, ...COUNTRIES.map((c) => ({ value: c.name, label: c.name }))]}
        />
        <SelectField label="Role" name="role" defaultValue={initial.role} required options={[{ value: "", label: "Choose your role" }, ...ROLES.map((r) => ({ value: r, label: r }))]} />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[12.5px] font-bold text-muted">Interests (pick any)</legend>
        <div className="grid grid-cols-2 gap-2">
          {INTERESTS.map((x) => (
            <Choice key={x} on={interests.includes(x)} onClick={() => toggle(interests, setInterests, x)} label={x} sub={INTEREST_HINT[x]} />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[12.5px] font-bold text-muted">How should we communicate? (pick any)</legend>
        <div className="grid grid-cols-3 gap-2">
          {CONTACT.map((x) => (
            <Choice key={x} on={contact.includes(x)} onClick={() => toggle(contact, setContact, x)} label={x} />
          ))}
        </div>
      </fieldset>

      {byAdmin ? null : <Toggle label="Receive newsletters by email" name="newsletter" defaultChecked={initial.newsletter} />}
      {children}
      <FormNote state={state} />
      <Button type="submit" size={inProfile ? "md" : "lg"} className={inProfile ? "self-start" : undefined} disabled={pending}>
        {pending ? "Saving…" : byAdmin ? "Save details" : inProfile ? "Save changes" : returning ? "Save and continue" : "Enter VentureWeavers"}
      </Button>
    </form>
  );
}

function Choice({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,box-shadow]",
        on ? "border-primary bg-soft shadow-depth-sm" : "border-line2 bg-card/70 hover:bg-card",
      )}
    >
      <b className="text-[13.5px]">{label}</b>
      {sub ? <span className="text-[11.5px] text-faint">{sub}</span> : null}
    </button>
  );
}
