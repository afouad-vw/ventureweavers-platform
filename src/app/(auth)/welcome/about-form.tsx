"use client";

import { useActionState, useEffect, useState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, Toggle } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { Plus, Trash2 } from "lucide-react";
import { BUSINESS_STAGES, BUSINESS_TYPES, CONTACT, INTEREST_HINT, INTERESTS, MAX_BUSINESSES, type Business } from "@/lib/profile/about";
import { AvatarField } from "@/components/profile/avatar-field";
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
  roles: string[];
  interests: string[];
  contact: string[];
  newsletter: boolean;
  avatar: string | null;
  businesses: Business[];
};

type BizRow = { key: number; name: string; type: string; stage: string; website: string; member_role: string; linkedin: string };
let bizKey = 0;
const toRow = (b?: Business): BizRow => ({ key: ++bizKey, name: b?.name ?? "", type: b?.type ?? "", stage: b?.stage ?? "", website: b?.website ?? "", member_role: b?.member_role ?? "", linkedin: b?.linkedin ?? "" });

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
  const [roles, setRoles] = useState<string[]>(initial.roles);
  const [biz, setBiz] = useState<BizRow[]>(() => initial.businesses.map(toRow));
  const setBizField = (key: number, field: keyof Omit<BizRow, "key">, value: string) => setBiz((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {interests.map((x) => <input key={x} type="hidden" name="interests" value={x} />)}
      {contact.map((x) => <input key={x} type="hidden" name="contact" value={x} />)}
      {roles.map((x) => <input key={x} type="hidden" name="roles" value={x} />)}
      <input type="hidden" name="businesses" value={JSON.stringify(biz.map((r) => ({ name: r.name, type: r.type, stage: r.type === "Venture" ? r.stage : "", website: r.website, member_role: r.member_role, linkedin: r.linkedin })))} />
      {inProfile ? null : (
        <div>
          <h1 className="font-display text-[24px] font-semibold">About you</h1>
          <p className="text-[13.5px] text-muted">{returning ? "We've added a few questions. It takes a minute." : "A few details so we can serve you well. It takes a minute."}</p>
        </div>
      )}

      {byAdmin ? null : <AvatarField name={initial.name} initial={initial.avatar} />}
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

      <SelectField
        label="Country"
        name="country"
        defaultValue={initial.country}
        required
        options={[{ value: "", label: "Choose your country" }, ...COUNTRIES.map((c) => ({ value: c.name, label: c.name }))]}
      />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[12.5px] font-bold text-muted">Ecosystem Role <span className="font-normal text-faint">(you can choose more than one)</span></legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((x) => (
            <Choice key={x} on={roles.includes(x)} onClick={() => toggle(roles, setRoles, x)} label={x} />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1.5 text-[12.5px] font-bold text-muted">Your businesses (optional)</legend>
        {biz.map((b, i) => (
          <div key={b.key} className="flex flex-col gap-3 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <b className="text-[13px]">{b.name.trim() || `Business ${i + 1}`}</b>
              <button
                type="button"
                onClick={() => setBiz((rows) => rows.filter((r) => r.key !== b.key))}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-[12.5px] font-bold text-muted hover:bg-hover hover:text-fg desk:min-h-8"
                aria-label={`Remove ${b.name.trim() || `business ${i + 1}`}`}
              >
                <Trash2 size={14} aria-hidden="true" />
                Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Business name" value={b.name} onChange={(e) => setBizField(b.key, "name", e.target.value)} maxLength={120} autoComplete="organization" required />
              <SelectField label="Type" value={b.type} onChange={(e) => setBizField(b.key, "type", e.target.value)} options={[{ value: "", label: "Choose" }, ...BUSINESS_TYPES.map((t) => ({ value: t, label: t }))]} />
            </div>
            {b.type === "Venture" ? (
              <SelectField label="Stage" value={b.stage} onChange={(e) => setBizField(b.key, "stage", e.target.value)} options={[{ value: "", label: "Choose the stage" }, ...BUSINESS_STAGES.map((t) => ({ value: t, label: t }))]} />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Your role in the business" value={b.member_role} onChange={(e) => setBizField(b.key, "member_role", e.target.value)} maxLength={80} placeholder="Co-founder, Partner, Advisor…" />
              <TextField label="Website" value={b.website} onChange={(e) => setBizField(b.key, "website", e.target.value)} inputMode="url" placeholder="yourcompany.com" maxLength={200} />
            </div>
            <TextField label="LinkedIn page" value={b.linkedin} onChange={(e) => setBizField(b.key, "linkedin", e.target.value)} inputMode="url" placeholder="linkedin.com/company/your-company" maxLength={200} />
          </div>
        ))}
        {biz.length < MAX_BUSINESSES ? (
          <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setBiz((rows) => [...rows, toRow()])}>
            <Plus size={15} aria-hidden="true" />
            {biz.length ? "Add another business" : "Add a business"}
          </Button>
        ) : null}
      </fieldset>

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
