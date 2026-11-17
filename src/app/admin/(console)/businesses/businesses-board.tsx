"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Copy, Download, Link2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ConfirmDelete, IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { MiniTag, StatusPill } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DEAL_STAGES, isOpen, money, pipelineTotal } from "@/lib/crm/format";
import { formatDate } from "@/lib/events/format";
import { createFromMemberBusiness, deleteCompany, deleteDeal, duplicateCompany, duplicateDeal, exportCompaniesCsv, linkPerson, setCompanyStatus, setDealStage, setTaskDone } from "./actions";
import { CompanyEditor, DealEditor, type CompanyDraft, type DealDraft, type Opt } from "./crm-editors";

type CompanyRow = CompanyDraft & { id: string; people: number; deals: { stage: string; value: number | null; currency: string }[]; ownerName: string | null; openTasks: number };
type BoardDeal = DealDraft & { id: string; company: string; ownerName: string | null; closed_at: string | null };
type TaskRow = { id: string; company_id: string; company: string; body: string; due_at: string | null; who: string | null };
type Suggestion = { key: string; memberId: string; memberName: string; memberHref: string; name: string; type: string | null; stage: string | null; website: string | null; linkedin: string | null; role: string | null; match: { id: string; name: string } | null };

const dueLabel = (iso: string | null) => (iso ? formatDate(iso) : "No due date");
const overdue = (iso: string | null) => Boolean(iso && new Date(iso).getTime() < Date.now());

// ---------------------------------------------------------------- businesses list

export function CompaniesList({ rows, base, staff, canManage }: { rows: CompanyRow[]; base: string; staff: Opt[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"active" | "archived">("active");
  const [editing, setEditing] = useState<CompanyDraft | null | "new">(null);
  const [deleting, setDeleting] = useState<CompanyRow | null>(null);
  const { pending, run } = useRunner();
  const router = useRouter();
  const toast = useToast();
  const needle = q.trim().toLowerCase();
  const list = useMemo(
    () => rows.filter((r) => r.status === show && (!needle || `${r.name} ${r.type ?? ""} ${r.country ?? ""} ${r.tags.join(" ")} ${r.ownerName ?? ""}`.toLowerCase().includes(needle))),
    [rows, show, needle],
  );
  const archived = rows.filter((r) => r.status === "archived").length;
  const href = (id: string) => `${base}/businesses/${id}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex w-full max-w-[300px] items-center">
            <Search size={16} className="pointer-events-none absolute left-2.5 text-faint" aria-hidden="true" />
            <span className="sr-only">Filter businesses</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, type, country or tag" className="h-10 w-full rounded-lg border border-line2 bg-card pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9" />
          </label>
          {archived ? (
            <Button variant="secondary" size="sm" onClick={() => setShow(show === "active" ? "archived" : "active")}>
              {show === "active" ? `Archived (${archived})` : "Back to active"}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await exportCompaniesCsv();
              if (!res.ok) return toast(res.error);
              const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
              Object.assign(document.createElement("a"), { href: url, download: `businesses-${new Date().toISOString().slice(0, 10)}.csv` }).click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} aria-hidden="true" />
            Export CSV
          </Button>
          {canManage ? (
            <Button onClick={() => setEditing("new")}>
              <Plus size={15} aria-hidden="true" />
              Add business
            </Button>
          ) : null}
        </div>
      </div>

      <TableBox minWidth={900} head={["Business", "Type", "People", "Open deals", "Tasks", "Owner", ""]} empty={!list.length && (rows.length ? "No businesses match." : "No businesses yet. Add one, or start from the businesses members listed.")}>
        {list.map((r) => {
          const open = r.deals.filter((d) => isOpen(d.stage));
          const won = r.deals.filter((d) => d.stage === "Won").length;
          return (
            <tr key={r.id} className="border-b border-line last:border-b-0 hover:bg-hover">
              <td className={td}>
                <Link href={href(r.id)} className="font-bold hover:underline">{r.name}</Link>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {r.country ? <span className="text-[12px] text-faint">{r.country}</span> : null}
                  {r.tags.slice(0, 3).map((t) => <MiniTag key={t}>{t}</MiniTag>)}
                </span>
              </td>
              <td className={`${td} text-muted`}>{r.type ?? "—"}{r.stage ? <span className="block text-[12px] text-faint">{r.stage}</span> : null}</td>
              <td className={`${td} text-muted`}>{r.people}</td>
              <td className={td}>
                {open.length ? <><b>{open.length}</b><span className="block text-[12px] text-faint">{pipelineTotal(r.deals) || "No value yet"}</span></> : <span className="text-faint">{won ? `${won} won` : "—"}</span>}
              </td>
              <td className={`${td} text-muted`}>{r.openTasks || "—"}</td>
              <td className={`${td} text-muted`}>{r.ownerName ?? "—"}</td>
              <td className={`${td} whitespace-nowrap`}>
                <div className="flex justify-end gap-1">
                  {canManage ? (
                    <>
                      <IconBtn label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil size={15} aria-hidden="true" /></IconBtn>
                      <IconBtn label={`Duplicate ${r.name}`} onClick={() => run(() => duplicateCompany(r.id), () => router.refresh())}><Copy size={15} aria-hidden="true" /></IconBtn>
                      <IconBtn label={r.status === "active" ? `Archive ${r.name}` : `Make ${r.name} active`} onClick={() => run(() => setCompanyStatus(r.id, r.status === "active" ? "archived" : "active"), () => router.refresh())}>
                        {r.status === "active" ? <Archive size={15} aria-hidden="true" /> : <ArchiveRestore size={15} aria-hidden="true" />}
                      </IconBtn>
                      <IconBtn label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                    </>
                  ) : null}
                  <Link href={href(r.id)} className={buttonClass("secondary", "sm")}>View details</Link>
                </div>
              </td>
            </tr>
          );
        })}
      </TableBox>

      <CompanyEditor
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        open={editing !== null}
        company={editing === "new" ? null : editing}
        staff={staff}
        onClose={() => setEditing(null)}
        onSaved={(id) => (editing === "new" && id ? router.push(href(id)) : router.refresh())}
      />
      <ConfirmDelete
        open={Boolean(deleting)}
        name={deleting?.name}
        pending={pending}
        note="Its deals, activity and tasks are deleted too; the people stay in Contacts. To keep it, archive it instead."
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && run(() => deleteCompany(deleting.id), () => { setDeleting(null); router.refresh(); })}
      />
    </>
  );
}

// ---------------------------------------------------------------- deals board

export function DealsBoard({ deals, base, companies, staff, services, programs, canManage }: { deals: BoardDeal[]; base: string; companies: Opt[]; staff: Opt[]; services: Opt[]; programs: Opt[]; canManage: boolean }) {
  const [editing, setEditing] = useState<DealDraft | null | "new">(null);
  const [deleting, setDeleting] = useState<BoardDeal | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const { pending, run } = useRunner();
  const router = useRouter();
  const stages = showClosed ? DEAL_STAGES : DEAL_STAGES.filter((s) => isOpen(s));
  const total = pipelineTotal(deals);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-faint">
          {deals.filter((d) => isOpen(d.stage)).length} open deals{total ? ` · ${total}` : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowClosed(!showClosed)}>{showClosed ? "Hide Won and Lost" : "Show Won and Lost"}</Button>
          {canManage ? (
            <Button onClick={() => setEditing("new")} disabled={!companies.length} title={companies.length ? undefined : "Add a business first"}>
              <Plus size={15} aria-hidden="true" />
              Add deal
            </Button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(230px, 1fr))`, minWidth: stages.length * 240 }}>
          {stages.map((stage) => {
            const col = deals.filter((d) => d.stage === stage);
            const sum = pipelineTotal(col.map((d) => ({ ...d, stage: "Lead" })));
            return (
              <section key={stage} aria-label={stage} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-hover/60 p-2.5">
                <header className="flex items-center justify-between gap-2 px-1">
                  <StatusPill tone={stage === "Won" ? "ok" : stage === "Lost" ? "draft" : stage === "Lead" ? "blue" : "warn"}>{stage}</StatusPill>
                  <span className="text-[11.5px] text-faint">{col.length}{sum ? ` · ${sum}` : ""}</span>
                </header>
                {col.length ? (
                  col.map((d) => (
                    <article key={d.id} className="glass flex flex-col gap-1.5 rounded-xl border p-3">
                      <b className="text-[13.5px] leading-snug">{d.title}</b>
                      <Link href={`${base}/businesses/${d.company_id}?tab=deals`} className="text-[12.5px] font-bold text-link hover:underline">{d.company}</Link>
                      <span className="text-[12.5px]">{money(d.value, d.currency)}</span>
                      <span className="flex flex-wrap gap-1">
                        <MiniTag>{d.type}</MiniTag>
                        {d.expected_close && isOpen(d.stage) ? <MiniTag>Close {formatDate(d.expected_close)}</MiniTag> : null}
                      </span>
                      {d.ownerName ? <span className="text-[12px] text-faint">Owner: {d.ownerName}</span> : null}
                      {canManage ? (
                        <div className="mt-1 flex items-center gap-1 border-t border-line pt-2">
                          <label className="sr-only" htmlFor={`stage-${d.id}`}>Move {d.title} to</label>
                          <select id={`stage-${d.id}`} value={d.stage} disabled={pending} onChange={(e) => run(() => setDealStage(d.id, e.target.value), () => router.refresh())} className="h-8 min-w-0 flex-1 rounded-md border border-line2 bg-card px-1.5 text-[12.5px]">
                            {DEAL_STAGES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <IconBtn label={`Edit ${d.title}`} onClick={() => setEditing(d)}><Pencil size={14} aria-hidden="true" /></IconBtn>
                          <IconBtn label={`Duplicate ${d.title}`} onClick={() => run(() => duplicateDeal(d.id), () => router.refresh())}><Copy size={14} aria-hidden="true" /></IconBtn>
                          <IconBtn label={`Delete ${d.title}`} onClick={() => setDeleting(d)}><Trash2 size={14} aria-hidden="true" /></IconBtn>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="px-1 py-3 text-center text-[12.5px] text-faint">No deals</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <DealEditor
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        open={editing !== null}
        deal={editing === "new" ? null : editing}
        companies={companies}
        staff={staff}
        services={services}
        programs={programs}
        onClose={() => { setEditing(null); router.refresh(); }}
      />
      <ConfirmDelete open={Boolean(deleting)} name={deleting?.title} pending={pending} note="Its stage history stays in the business's activity. To keep the deal, set it to Lost instead." onClose={() => setDeleting(null)} onConfirm={() => deleting && run(() => deleteDeal(deleting.id), () => { setDeleting(null); router.refresh(); })} />
    </>
  );
}

// ---------------------------------------------------------------- tasks

export function TasksList({ tasks, base, canManage }: { tasks: TaskRow[]; base: string; canManage: boolean }) {
  const { pending, run } = useRunner();
  const router = useRouter();
  if (!tasks.length) return <EmptyState>No open tasks. Add tasks from a business&apos;s Activity tab.</EmptyState>;
  return (
    <TableBox minWidth={700} head={["Task", "Business", "Due", "Added by", ""]}>
      {tasks.map((t) => (
        <tr key={t.id} className="border-b border-line last:border-b-0 hover:bg-hover">
          <td className={`${td} max-w-[380px] whitespace-pre-line`}>{t.body}</td>
          <td className={td}><Link href={`${base}/businesses/${t.company_id}?tab=activity`} className="font-bold text-link hover:underline">{t.company}</Link></td>
          <td className={cn(td, overdue(t.due_at) ? "font-bold text-bad-fg" : "text-muted")}>{dueLabel(t.due_at)}{overdue(t.due_at) ? " · overdue" : ""}</td>
          <td className={`${td} text-muted`}>{t.who ?? "—"}</td>
          <td className={`${td} text-right`}>
            {canManage ? (
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setTaskDone(t.id, true), () => router.refresh())}>
                <Check size={14} aria-hidden="true" />
                Done
              </Button>
            ) : null}
          </td>
        </tr>
      ))}
    </TableBox>
  );
}

// ---------------------------------------------------------------- from member profiles

export function MemberBusinesses({ items, base, canManage }: { items: Suggestion[]; base: string; canManage: boolean }) {
  const { pending, run } = useRunner();
  const router = useRouter();
  if (!items.length) return <EmptyState>Every business members listed in their profiles is already linked here.</EmptyState>;
  return (
    <>
      <p className="text-[13px] text-muted">Businesses members listed in their profiles that aren&apos;t linked yet. Add them as a business, or link the member to a business you already have.</p>
      <TableBox minWidth={820} head={["Business", "Member", "Their role", "Match", ""]}>
        {items.map((s) => (
          <tr key={s.key} className="border-b border-line last:border-b-0 hover:bg-hover">
            <td className={td}>
              <b>{s.name}</b>
              <span className="block text-[12px] text-faint">{[s.type, s.stage, s.website?.replace(/^https?:\/\/(www\.)?/, "")].filter(Boolean).join(" · ") || "—"}</span>
            </td>
            <td className={td}><Link href={`${base}${s.memberHref}`} className="font-bold text-link hover:underline">{s.memberName}</Link></td>
            <td className={`${td} text-muted`}>{s.role ?? "—"}</td>
            <td className={td}>{s.match ? <Link href={`${base}/businesses/${s.match.id}`} className="text-link hover:underline">{s.match.name}</Link> : <span className="text-faint">New</span>}</td>
            <td className={`${td} whitespace-nowrap text-right`}>
              {canManage ? (
                s.match ? (
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => linkPerson(s.match!.id, `m:${s.memberId}`, s.role ?? ""), () => router.refresh())}>
                    <Link2 size={14} aria-hidden="true" />
                    Link to {s.match.name}
                  </Button>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => run(() => createFromMemberBusiness(s.memberId, s), () => router.refresh())}>
                    <Plus size={14} aria-hidden="true" />
                    Add business
                  </Button>
                )
              ) : null}
            </td>
          </tr>
        ))}
      </TableBox>
    </>
  );
}

