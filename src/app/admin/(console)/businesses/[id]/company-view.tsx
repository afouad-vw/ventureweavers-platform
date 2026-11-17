"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Calendar, Check, Copy, Mail, MessageSquare, Pencil, Phone, Plus, RotateCcw, Search, StickyNote, Trash2, TrendingUp, Users, X } from "lucide-react";
import { ConfirmDelete, IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { MiniTag, StatusPill } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import { ACTIVITY_KINDS, DEAL_STAGES, isOpen, money } from "@/lib/crm/format";
import { formatDate } from "@/lib/events/format";
import { deleteActivity, deleteCompany, deleteDeal, duplicateCompany, duplicateDeal, linkPerson, logActivity, setCompanyStatus, setDealStage, setTaskDone, unlinkPerson, updatePersonRole } from "../actions";
import { CompanyEditor, DealEditor, type CompanyDraft, type DealDraft, type Opt } from "../crm-editors";

type Person = { id: string; role: string | null; source: "team" | "profile"; key: string; name: string; email: string | null; member: boolean; href: string };
type Deal = DealDraft & { id: string; ownerName: string | null; closed_at: string | null };
type Entry = { key: string; at: string; kind: string; title: string; detail?: string; who?: string; due_at?: string | null; done_at?: string | null; id?: string; deal?: string };

// ---------------------------------------------------------------- header actions

export function CompanyActions({ company, staff, base }: { company: CompanyDraft & { id: string }; staff: Opt[]; base: string }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { pending, run } = useRunner();
  const router = useRouter();
  const archived = company.status === "archived";
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />Edit</Button>
      <IconBtn label={`Duplicate ${company.name}`} onClick={() => run(() => duplicateCompany(company.id), () => router.push(`${base}/businesses`))}><Copy size={15} aria-hidden="true" /></IconBtn>
      <IconBtn label={archived ? "Make active" : "Archive"} onClick={() => run(() => setCompanyStatus(company.id, archived ? "active" : "archived"), () => router.refresh())}>
        {archived ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}
      </IconBtn>
      <IconBtn label={`Delete ${company.name}`} onClick={() => setDeleting(true)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
      <CompanyEditor open={editing} company={company} staff={staff} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />
      <ConfirmDelete
        open={deleting}
        name={company.name}
        pending={pending}
        note="Its deals, activity and tasks are deleted too; the people stay in Contacts. To keep it, archive it instead."
        onClose={() => setDeleting(false)}
        onConfirm={() => run(() => deleteCompany(company.id), () => router.push(`${base}/businesses`))}
      />
    </div>
  );
}

// ---------------------------------------------------------------- people

export function PeopleCard({ companyId, people, options, base, canManage, linkPeople }: { companyId: string; people: Person[]; options: Opt[]; base: string; canManage: boolean; linkPeople: boolean }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [roleEdit, setRoleEdit] = useState<{ id: string; role: string } | null>(null);
  const { pending, run } = useRunner();
  const router = useRouter();
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)).slice(0, 8) : []), [options, needle]);
  const done = () => { setQ(""); setRole(""); router.refresh(); };

  return (
    <Card>
      <CardHeader
        title="People"
        action={canManage && !adding ? <Button variant="secondary" size="sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" />Link someone</Button> : null}
      />
      {adding ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <b className="text-[13px]">Link a member or contact</b>
            <IconBtn label="Close" onClick={() => setAdding(false)}><X size={15} aria-hidden="true" /></IconBtn>
          </div>
          <TextField label="Their role at this business (optional)" value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="e.g. CEO, Head of Partnerships" />
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" aria-hidden="true" />
            <label htmlFor="link-q" className="sr-only">Find someone in Contacts</label>
            <input id="link-q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Type a name or email" className="h-10 w-full rounded-lg border border-line2 bg-card pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9" />
          </div>
          {matches.length ? (
            <ul className="flex max-h-56 flex-col overflow-y-auto rounded-lg border border-line bg-card">
              {matches.map((o) => (
                <li key={o.value}>
                  <button type="button" disabled={pending} onClick={() => run(() => linkPerson(companyId, o.value, role), done)} className="flex min-h-10 w-full cursor-pointer items-center px-3 py-1.5 text-left text-[13px] hover:bg-hover">{o.label}</button>
                </li>
              ))}
            </ul>
          ) : needle ? (
            <p className="text-[12.5px] text-faint">No match. Add new people in Contacts first.</p>
          ) : null}
        </div>
      ) : null}
      {people.length ? (
        <ul className="flex flex-col">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-b-0">
              <span className="min-w-0 flex-1">
                {linkPeople ? <Link href={`${base}${p.href}`} className="font-bold hover:underline">{p.name}</Link> : <b>{p.name}</b>}
                <span className="block text-[12px] text-faint">{[p.role ?? "Role not given", p.member ? "Member" : "Contact", p.source === "profile" ? "from their profile" : null, p.email].filter(Boolean).join(" · ")}</span>
              </span>
              {canManage ? (
                roleEdit?.id === p.id ? (
                  <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); run(() => updatePersonRole(p.id, roleEdit.role), () => { setRoleEdit(null); router.refresh(); }); }}>
                    <label className="sr-only" htmlFor={`role-${p.id}`}>Role</label>
                    <input id={`role-${p.id}`} autoFocus value={roleEdit.role} onChange={(e) => setRoleEdit({ id: p.id, role: e.target.value })} maxLength={80} className="h-8 w-[150px] rounded-md border border-line2 bg-card px-2 text-[13px]" />
                    <IconBtn label="Save role" onClick={() => run(() => updatePersonRole(p.id, roleEdit.role), () => { setRoleEdit(null); router.refresh(); })}><Check size={15} aria-hidden="true" /></IconBtn>
                  </form>
                ) : (
                  <span className="flex gap-1">
                    <IconBtn label={`Edit ${p.name}'s role`} onClick={() => setRoleEdit({ id: p.id, role: p.role ?? "" })}><Pencil size={14} aria-hidden="true" /></IconBtn>
                    <IconBtn label={p.source === "profile" ? `Remove ${p.name} (they listed this business; it comes back if they save their profile again)` : `Remove ${p.name} from this business`} onClick={() => run(() => unlinkPerson(p.id), () => router.refresh())}><X size={15} aria-hidden="true" /></IconBtn>
                  </span>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-faint">No one linked yet.</span>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- deals

export function DealsPanel({ companyId, deals, staff, services, programs, canManage }: { companyId: string; deals: Deal[]; staff: Opt[]; services: Opt[]; programs: Opt[]; canManage: boolean }) {
  const [editing, setEditing] = useState<DealDraft | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const { pending, run } = useRunner();
  const router = useRouter();
  const blank: DealDraft = { company_id: companyId, title: "", type: "Revenue-based", stage: "Lead", value: null, currency: "EGP", expected_close: null, owner: null, service_id: null, program_id: null, notes: "" };
  const label = (list: Opt[], id: string | null) => (id ? list.find((o) => o.value === id)?.label : undefined);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-faint">{deals.length} deals</span>
        {canManage ? <Button onClick={() => setEditing(blank)}><Plus size={15} aria-hidden="true" />Add deal</Button> : null}
      </div>
      <TableBox minWidth={860} head={["Deal", "Type", "Value", "Stage", "Expected close", "Owner", ""]} empty={!deals.length && "No deals yet."}>
        {deals.map((d) => (
          <tr key={d.id} className="border-b border-line last:border-b-0 hover:bg-hover">
            <td className={td}>
              <b>{d.title}</b>
              {label(services, d.service_id) || label(programs, d.program_id) ? <span className="block text-[12px] text-faint">For {label(services, d.service_id) ?? label(programs, d.program_id)}</span> : null}
              {d.notes ? <span className="mt-0.5 block max-w-[320px] truncate text-[12px] text-faint">{d.notes}</span> : null}
            </td>
            <td className={`${td} text-muted`}>{d.type}</td>
            <td className={td}>{money(d.value, d.currency)}</td>
            <td className={td}>
              {canManage ? (
                <>
                  <label className="sr-only" htmlFor={`st-${d.id}`}>Stage of {d.title}</label>
                  <select id={`st-${d.id}`} value={d.stage} disabled={pending} onChange={(e) => run(() => setDealStage(d.id, e.target.value), () => router.refresh())} className="h-8 rounded-md border border-line2 bg-card px-1.5 text-[12.5px]">
                    {DEAL_STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </>
              ) : (
                <StatusPill tone={d.stage === "Won" ? "ok" : d.stage === "Lost" ? "draft" : "warn"}>{d.stage}</StatusPill>
              )}
              {d.closed_at ? <span className="block text-[12px] text-faint">Closed {formatDate(d.closed_at)}</span> : null}
            </td>
            <td className={`${td} text-muted`}>{d.expected_close && isOpen(d.stage) ? formatDate(d.expected_close) : "—"}</td>
            <td className={`${td} text-muted`}>{d.ownerName ?? "—"}</td>
            <td className={td}>
              {canManage ? (
                <div className="flex justify-end gap-1">
                  <IconBtn label={`Edit ${d.title}`} onClick={() => setEditing(d)}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Duplicate ${d.title}`} onClick={() => run(() => duplicateDeal(d.id), () => router.refresh())}><Copy size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={`Delete ${d.title}`} onClick={() => setDeleting(d)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </TableBox>
      <DealEditor key={editing?.id ?? "new"} open={Boolean(editing)} deal={editing} staff={staff} services={services} programs={programs} onClose={() => { setEditing(null); router.refresh(); }} />
      <ConfirmDelete open={Boolean(deleting)} name={deleting?.title} pending={pending} note="Its stage history stays in the activity. To keep the deal, set it to Lost instead." onClose={() => setDeleting(null)} onConfirm={() => deleting && run(() => deleteDeal(deleting.id), () => { setDeleting(null); router.refresh(); })} />
    </>
  );
}

// ---------------------------------------------------------------- activity

const ICON: Record<string, typeof StickyNote> = { note: StickyNote, call: Phone, meeting: Users, email: Mail, task: Calendar, stage: TrendingUp, platform: MessageSquare };
const KIND_LABEL: Record<string, string> = { note: "Note", call: "Call", meeting: "Meeting", email: "Email", task: "Task", stage: "Deal", platform: "On the platform" };

export function ActivityPanel({ companyId, entries, deals, canManage, compact }: { companyId: string; entries: Entry[]; deals: Opt[]; canManage: boolean; compact?: boolean }) {
  const [kind, setKind] = useState("note");
  const [filter, setFilter] = useState("all");
  const [formKey, setFormKey] = useState(0);
  const { pending, error, run } = useRunner();
  const router = useRouter();
  const shown = filter === "all" ? entries : filter === "team" ? entries.filter((e) => e.kind !== "platform") : entries.filter((e) => e.kind === filter);

  return (
    <div className="flex flex-col gap-3">
      {canManage && !compact ? (
        <Card>
          <CardHeader title="Log activity" />
          <form
            key={formKey}
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => logActivity(fd), () => { setFormKey((k) => k + 1); router.refresh(); });
            }}
          >
            <input type="hidden" name="company_id" value={companyId} />
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label="What" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={ACTIVITY_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
              {deals.length ? <SelectField label="Deal (optional)" name="deal_id" defaultValue="" options={[{ value: "", label: "None" }, ...deals]} /> : null}
              {kind === "task" ? <TextField label="Due" name="due_at" type="date" /> : null}
            </div>
            <TextArea label={kind === "task" ? "Task" : "What happened"} name="body" required rows={3} maxLength={4000} placeholder={kind === "task" ? "e.g. Send the proposal to Mona" : "e.g. Intro call with the CEO; they want a 6-month plan."} />
            {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
            <Button type="submit" className="self-start" disabled={pending}>{pending ? "Saving…" : kind === "task" ? "Add task" : "Log it"}</Button>
          </form>
        </Card>
      ) : null}

      {!compact ? (
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {[["all", "All"], ["team", "Team only"], ["task", "Tasks"], ["stage", "Deals"], ["platform", "On the platform"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v} className={cn("h-8 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold whitespace-nowrap", filter === v ? "border-primary bg-soft text-fg" : "border-line2 text-faint hover:text-fg")}>{l}</button>
          ))}
        </div>
      ) : null}

      {shown.length ? (
        <ol className={cn("flex flex-col", !compact && "glass rounded-2xl border px-3")}>
          {shown.map((e) => {
            const Icon = ICON[e.kind] ?? StickyNote;
            const task = e.kind === "task";
            const late = task && !e.done_at && e.due_at && new Date(e.due_at).getTime() < Date.now();
            return (
              <li key={e.key} className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full", e.kind === "platform" ? "bg-hover text-faint" : "bg-mint text-ink")}><Icon size={15} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13.5px] whitespace-pre-line break-words", task && e.done_at && "text-faint line-through")}>{e.title}</p>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-faint">
                    <MiniTag>{KIND_LABEL[e.kind] ?? e.kind}</MiniTag>
                    {e.deal ? <MiniTag>{e.deal}</MiniTag> : null}
                    {e.detail ? <span>{e.detail}</span> : null}
                    {e.who ? <span>{e.who}</span> : null}
                    <span>{relativeWhen(e.at)}</span>
                    {task && e.due_at ? <span className={cn(late && "font-bold text-bad-fg")}>Due {formatDate(e.due_at)}{late ? " · overdue" : ""}</span> : null}
                  </span>
                </div>
                {canManage && e.id && e.kind !== "stage" && e.kind !== "platform" ? (
                  <span className="flex shrink-0 gap-1">
                    {task ? (
                      <IconBtn label={e.done_at ? "Reopen task" : "Mark done"} onClick={() => run(() => setTaskDone(e.id!, !e.done_at), () => router.refresh())}>
                        {e.done_at ? <RotateCcw size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                      </IconBtn>
                    ) : null}
                    {!compact ? <IconBtn label="Delete entry" onClick={() => run(() => deleteActivity(e.id!), () => router.refresh())}><Trash2 size={15} aria-hidden="true" /></IconBtn> : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState>{entries.length ? "Nothing in this view." : "No activity yet. Log calls, meetings and notes here; deal stage changes and what linked people do on the platform show up too."}</EmptyState>
      )}
    </div>
  );
}
