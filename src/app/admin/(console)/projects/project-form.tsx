"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { DEFAULT_DIMENSIONS, HEALTH, PROJECT_STATUSES, SERVICES } from "@/lib/projects/format";
import type { Project } from "@/lib/projects/queries";
import { uploadFile } from "@/lib/upload-client";

export type Option = { value: string; label: string };

/** The project settings form (inside an EditorDrawer): who it's for, terms, proposal, folder and calendar. */
export function ProjectFields({ p, portfolios, companies, defaults }: { p: Project | null; portfolios: Option[]; companies: Option[]; defaults?: { parent_id?: string; kind?: "portfolio" | "venture" } }) {
  const [kind, setKind] = useState<string>(p?.kind ?? defaults?.kind ?? "venture");
  return (
    <>
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <TextField label="Project name" name="name" defaultValue={p?.name ?? ""} required maxLength={120} placeholder="The Cooking School" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "portfolio", label: "Portfolio (can hold ventures)" }, { value: "venture", label: "Venture" }]} />
        {kind === "venture" ? (
          <SelectField label="Part of portfolio" name="parent_id" defaultValue={p?.parent_id ?? defaults?.parent_id ?? ""} options={[{ value: "", label: "None (stand-alone venture)" }, ...portfolios.filter((x) => x.value !== p?.id)]} />
        ) : (
          <span />
        )}
        <SelectField label="Client business" name="company_id" defaultValue={p?.company_id ?? ""} options={[{ value: "", label: "Not linked" }, ...companies]} hint="From Admin › Businesses." />
        <SelectField label="Service" name="service" defaultValue={p?.service ?? "fractional_leadership"} options={SERVICES} />
        <SelectField label="Status" name="status" defaultValue={p?.status ?? "proposal"} options={PROJECT_STATUSES} />
        <SelectField label="Health" name="health" defaultValue={p?.health ?? "green"} options={HEALTH.map((h) => ({ value: h.value, label: h.label }))} />
      </div>
      <TextArea label="Summary" name="summary" rows={3} defaultValue={p?.summary ?? ""} maxLength={800} placeholder="A strategic partner to build and grow the portfolio…" />
      <TextArea label="Goals (one per line)" name="goals" rows={3} defaultValue={p?.goals.join("\n") ?? ""} placeholder={"A clear portfolio direction and roadmap\nEvery venture governed and reporting"} />
      <TextArea label="Dimensions (one per line)" name="dimensions" rows={4} defaultValue={(p?.dimensions ?? DEFAULT_DIMENSIONS).join("\n")} hint="The workstreams of this project; used for scope and, next, tasks and the assessment." />
      <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-[12.5px] font-bold text-muted">Terms</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Monthly retainer" name="retainer_amount" inputMode="decimal" defaultValue={p?.retainer_amount ?? ""} placeholder="3000" />
          <SelectField label="Currency" name="currency" defaultValue={p?.currency ?? "USD"} options={["USD", "EGP"]} />
          <SelectField label="Billing" name="billing" defaultValue={p?.billing ?? "end_of_month"} options={[{ value: "end_of_month", label: "End of each month" }, { value: "start_of_month", label: "Start of each month" }]} />
          <TextField label="Starts on" name="starts_on" type="date" defaultValue={p?.starts_on ?? ""} />
          <TextField label="Term (months)" name="term_months" type="number" min={1} max={60} defaultValue={p?.term_months ?? ""} placeholder="12" />
        </div>
        <TextField label="Cadence" name="cadence" defaultValue={p?.cadence ?? ""} maxLength={300} placeholder="4–5 hours of sessions every week; emails answered within 1–2 working days" />
        <TextArea label="Key terms" name="key_terms" rows={4} defaultValue={p?.key_terms ?? ""} maxLength={6000} placeholder={"Third parties work under their own agreements and fees.\nFinal business decisions are yours."} />
      </fieldset>
      <ProposalField initialPath={p?.proposal_path ?? null} initialName={p?.proposal_name ?? null} accepted={Boolean(p?.proposal_accepted_at)} />
      <TextField label="Project folder link (project assets)" name="drive_url" type="url" defaultValue={p?.drive_url ?? ""} maxLength={300} placeholder="https://drive.google.com/drive/folders/…" hint="Any https link (Google Drive, SharePoint, Dropbox). Share it with the client people first; Google Drive folders also show their files on the project page." />
      <TextField label="Calendly link for sessions (optional)" name="calendly_url" type="url" defaultValue={p?.calendly_url ?? ""} maxLength={300} placeholder="https://calendly.com/karim/weekly-session" hint="Lets the client book sessions themselves; bookings appear in Meetings." />
    </>
  );
}

/** The proposal PDF (private; clients download it through a 5-minute link). */
function ProposalField({ initialPath, initialName, accepted }: { initialPath: string | null; initialName: string | null; accepted: boolean }) {
  const [path, setPath] = useState(initialPath);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-muted">Proposal (PDF)</span>
      <input type="hidden" name="proposal_path" value={path ?? ""} />
      <input type="hidden" name="proposal_name" value={name ?? ""} />
      {path ? <span className="flex items-center gap-2 text-[13px] font-bold"><FileText size={16} className="text-primary" aria-hidden="true" />{name ?? "Proposal.pdf"}</span> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => ref.current?.click()}>
          <FileText size={14} aria-hidden="true" />
          {pending ? "Uploading…" : path ? "Replace PDF" : "Upload PDF"}
        </Button>
        {path ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setPath(null); setName(null); }}><Trash2 size={14} aria-hidden="true" />Remove</Button> : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setError(null);
          start(async () => {
            const r = await uploadFile("project-files", f);
            if (r.ok) { setPath(r.file.path); setName(r.file.fileName); } else setError(r.error);
            if (ref.current) ref.current.value = "";
          });
        }}
      />
      <span className="text-[12px] text-faint">PDF up to 20 MB, private to the people on the project.{accepted ? " Replacing it asks the client lead to accept again." : ""}</span>
      {error ? <span role="alert" className="text-[12.5px] font-bold text-bad-fg">{error}</span> : null}
    </div>
  );
}
