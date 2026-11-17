"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { IconBtn, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { linkPerson } from "../../businesses/actions";

/** Link this contact to a business in the CRM, with their role there. */
export function AddToBusiness({ who, options }: { who: string; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const { pending, error, run } = useRunner();
  const router = useRouter();
  if (!open)
    return (
      <Button variant="secondary" size="sm" className="mt-1.5 self-start" onClick={() => setOpen(true)} disabled={!options.length} title={options.length ? undefined : "No other businesses to link"}>
        <Plus size={14} aria-hidden="true" />
        Add to a business
      </Button>
    );
  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-xl border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => linkPerson(company, who, role), () => { setOpen(false); setCompany(""); setRole(""); router.refresh(); });
      }}
    >
      <div className="flex items-center justify-between">
        <b className="text-[13px]">Add to a business</b>
        <IconBtn label="Close" onClick={() => setOpen(false)}><X size={15} aria-hidden="true" /></IconBtn>
      </div>
      <SelectField label="Business" value={company} onChange={(e) => setCompany(e.target.value)} required options={[{ value: "", label: "Choose a business" }, ...options]} />
      <TextField label="Their role at this business" value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="e.g. CEO, Head of Partnerships" />
      {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
      <Button type="submit" size="sm" className="self-start" disabled={pending || !company}>{pending ? "Adding…" : "Add"}</Button>
    </form>
  );
}
