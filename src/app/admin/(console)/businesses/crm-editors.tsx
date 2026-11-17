"use client";

import { useState } from "react";
import { EditorDrawer, type Result, useRunner } from "@/components/admin/crud";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { CURRENCIES, DEAL_STAGES, DEAL_TYPE_HINT, DEAL_TYPES, RELATIONSHIPS } from "@/lib/crm/format";
import { cn } from "@/lib/cn";
import { BUSINESS_STAGES, BUSINESS_TYPES } from "@/lib/profile/about";
import { saveCompany, saveDeal } from "./actions";

export type Opt = { value: string; label: string };
export type CompanyDraft = {
  id?: string;
  name: string;
  type: string | null;
  stage: string | null;
  website: string | null;
  linkedin: string | null;
  country: string | null;
  tags: string[];
  relationships: string[];
  notes: string;
  owner: string | null;
  status: "active" | "archived";
};
export type DealDraft = {
  id?: string;
  company_id: string;
  title: string;
  type: string;
  stage: string;
  value: number | null;
  currency: string;
  expected_close: string | null;
  owner: string | null;
  service_id: string | null;
  program_id: string | null;
  notes: string;
};

const none = (label: string, list: Opt[]): Opt[] => [{ value: "", label }, ...list];

/** Add or edit a business (shared editor drawer). */
export function CompanyEditor({ open, company, staff, onClose, onSaved }: { open: boolean; company: CompanyDraft | null; staff: Opt[]; onClose: () => void; onSaved?: (id?: string) => void }) {
  const { pending, error, setError, run } = useRunner();
  const [type, setType] = useState(company?.type ?? "");
  const [rel, setRel] = useState<string[]>(company?.relationships ?? []);
  const c = company;
  return (
    <EditorDrawer
      open={open}
      onClose={() => { setError(null); onClose(); }}
      eyebrow="Businesses"
      title={c?.id ? `Edit ${c.name}` : "Add a business"}
      pending={pending}
      error={error}
      formKey={c?.id ?? "new"}
      onSubmit={(fd) => {
        let saved: string | undefined;
        run(async () => {
          const r = await saveCompany(fd);
          if (r.ok) saved = r.id;
          return r as Result;
        }, () => { onClose(); onSaved?.(saved); });
      }}
    >
      {c?.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <TextField label="Business name" name="name" defaultValue={c?.name ?? ""} required maxLength={120} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Relationship with VW <span className="font-normal text-faint">(choose any that apply)</span></legend>
        <div className="flex flex-wrap gap-1.5">
          {RELATIONSHIPS.map((r) => {
            const on = rel.includes(r);
            return (
              <label key={r} className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary", on ? "border-primary bg-soft text-fg" : "border-line2 text-muted hover:text-fg")}>
                <input type="checkbox" name="relationships" value={r} checked={on} onChange={() => setRel((l) => (on ? l.filter((x) => x !== r) : [...l, r]))} className="sr-only" />
                {r}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Type" name="type" defaultValue={c?.type ?? ""} onChange={(e) => setType(e.target.value)} options={none("Not set", BUSINESS_TYPES.map((t) => ({ value: t, label: t })))} />
        {type === "Venture" ? <SelectField label="Stage" name="stage" defaultValue={c?.stage ?? ""} options={none("Not set", BUSINESS_STAGES.map((s) => ({ value: s, label: s })))} /> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Website" name="website" defaultValue={c?.website ?? ""} placeholder="company.com" maxLength={200} />
        <TextField label="LinkedIn page" name="linkedin" defaultValue={c?.linkedin ?? ""} placeholder="linkedin.com/company/name" maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Country" name="country" defaultValue={c?.country ?? ""} maxLength={80} />
        <SelectField label="Owner" name="owner" defaultValue={c?.owner ?? ""} options={none("No owner", staff)} />
      </div>
      <TextField label="Tags" name="tags" defaultValue={(c?.tags ?? []).join(", ")} hint="Separate with commas, up to 10." />
      <TextArea label="Notes" name="notes" defaultValue={c?.notes ?? ""} rows={4} maxLength={4000} />
      <SelectField label="Status" name="status" defaultValue={c?.status ?? "active"} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
    </EditorDrawer>
  );
}

/** Add or edit a B2B deal. */
export function DealEditor({
  open,
  deal,
  companies,
  staff,
  services,
  programs,
  onClose,
}: {
  open: boolean;
  deal: DealDraft | null;
  companies?: Opt[];
  staff: Opt[];
  services: Opt[];
  programs: Opt[];
  onClose: () => void;
}) {
  const { pending, error, setError, run } = useRunner();
  const [type, setType] = useState(deal?.type ?? "Revenue-based");
  const d = deal;
  return (
    <EditorDrawer
      open={open}
      onClose={() => { setError(null); onClose(); }}
      eyebrow="Deals"
      title={d?.id ? `Edit ${d.title}` : "Add a deal"}
      pending={pending}
      error={error}
      formKey={d?.id ?? `new-${d?.company_id ?? ""}`}
      onSubmit={(fd) => run(() => saveDeal(fd), onClose)}
    >
      {d?.id ? <input type="hidden" name="id" value={d.id} /> : null}
      {companies && !d?.id ? (
        <SelectField label="Business" name="company_id" defaultValue={d?.company_id ?? ""} required options={none("Choose a business", companies)} />
      ) : (
        <input type="hidden" name="company_id" value={d?.company_id ?? ""} />
      )}
      <TextField label="Deal title" name="title" defaultValue={d?.title ?? ""} required maxLength={160} placeholder="e.g. Fractional CFO, 6 months" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Deal type" name="type" defaultValue={type} onChange={(e) => setType(e.target.value)} options={DEAL_TYPES} hint={DEAL_TYPE_HINT[type as (typeof DEAL_TYPES)[number]]} />
        <SelectField label="Stage" name="stage" defaultValue={d?.stage ?? "Lead"} options={DEAL_STAGES} />
      </div>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <TextField label="Value" name="value" inputMode="decimal" defaultValue={d?.value ?? ""} placeholder="e.g. 18000" hint="Leave empty if not known yet." />
        <SelectField label="Currency" name="currency" defaultValue={d?.currency ?? "EGP"} options={CURRENCIES} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Expected close" name="expected_close" type="date" defaultValue={d?.expected_close ?? ""} />
        <SelectField label="Owner" name="owner" defaultValue={d?.owner ?? ""} options={none("No owner", staff)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="BRICKR service (optional)" name="service_id" defaultValue={d?.service_id ?? ""} options={none("None", services)} />
        <SelectField label="TVS program (optional)" name="program_id" defaultValue={d?.program_id ?? ""} options={none("None", programs)} />
      </div>
      <TextArea label="Notes" name="notes" defaultValue={d?.notes ?? ""} rows={4} maxLength={4000} />
    </EditorDrawer>
  );
}
