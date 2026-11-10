"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Mail, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Drawer, Modal } from "@/components/ui/overlay";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatEGP } from "@/lib/events/format";
import { filterLedger, KIND_LABEL, METHOD_LABEL, nextActions, STATUS_FILTERS, statusLabel, statusTone, totals, type LedgerRow } from "@/lib/payments/format";
import type { MemberOption } from "@/lib/payments/queries";
import { changePayment, deleteRequest, duplicateRequest, exportPaymentsCsv, saveRequest, sendRequestEmail } from "./actions";

export type RequestDetail = { id: string; due_on: string | null; note: string };
const SPACES = ["All", "Outloud", "TVS", "BRICKR", "QuidQuo", "House"];
const ACTION_LABEL = { paid: "Mark paid", cancel: "Cancel", refund: "Mark refunded (full)" } as const;

export function PaymentsBoard({ rows, members, details, admins }: { rows: LedgerRow[]; members: MemberOption[]; details: Record<string, RequestDetail>; admins: Record<string, string> }) {
  const [status, setStatus] = useState<string>("All");
  const [space, setSpace] = useState("All");
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [edit, setEdit] = useState<LedgerRow | "new" | null>(null);
  const [del, setDel] = useState<LedgerRow | null>(null);
  const [confirm, setConfirm] = useState<{ row: LedgerRow; action: "paid" | "cancel" | "refund" } | null>(null);
  const r = useRunner();
  const toast = useToast();
  const list = useMemo(() => filterLedger(rows, status, space, q), [rows, status, space, q]);
  const t = totals(rows);
  const sel = rows.find((x) => `${x.kind}:${x.id}` === openKey) ?? null;
  const e = edit && edit !== "new" ? edit : null;
  const ed = e ? details[e.id] : undefined;

  return (
    <>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {([
          ["Collected", formatEGP(t.collected), "bg-teal"],
          ["Pending", `${formatEGP(t.pending)} · ${t.pendingCount}`, "bg-out"],
          ["Refunded", formatEGP(t.refunded), "bg-line2"],
          ["Transactions", String(t.transactions), "bg-tvs"],
        ] as const).map(([l, v, dot]) => (
          <div key={l} className="rounded-xl border border-line bg-card p-3.5">
            <small className="flex items-center gap-1.5 text-[12px] font-bold text-faint"><i className={cn("h-2 w-2 rounded-full", dot)} aria-hidden="true" />{l}</small>
            <b className="font-display text-[21px]">{v}</b>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {STATUS_FILTERS.map((s) => {
            const n = s === "All" ? null : rows.filter((x) => statusLabel(x.status) === s).length;
            return (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={cn("h-9 cursor-pointer rounded-full border px-3 text-[12.5px] font-bold", status === s ? "border-primary bg-primary text-white" : "border-line2 bg-card text-fg hover:bg-hover")}>
                {s}{n !== null ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <label className="sr-only" htmlFor="pay-space">Space</label>
        <select id="pay-space" value={space} onChange={(ev) => setSpace(ev.target.value)} className="h-10 rounded-lg border border-line2 bg-card px-2.5 text-[13.5px] desk:h-9">
          {SPACES.map((s) => <option key={s} value={s}>{s === "All" ? "All spaces" : s === "House" ? "VentureWeavers" : s}</option>)}
        </select>
        <label className="relative flex w-full max-w-[280px] items-center">
          <Search size={16} className="pointer-events-none absolute left-2.5 text-faint" aria-hidden="true" />
          <span className="sr-only">Search payments</span>
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Name, item or reference" className="h-10 w-full rounded-lg border border-line2 bg-card pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9" />
        </label>
        <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            const res = await exportPaymentsCsv(status, space, q);
            if (!res.ok) return toast(res.error);
            const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
            Object.assign(document.createElement("a"), { href: url, download: `payments-${new Date().toISOString().slice(0, 10)}.csv` }).click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={15} aria-hidden="true" />
          Export CSV
        </Button>
        <Button onClick={() => { r.setError(null); setEdit("new"); }}>
          <Plus size={15} aria-hidden="true" />
          New payment request
        </Button>
        </div>

      </div>

      <TableBox minWidth={900} head={["Date", "Member", "Item", "Method", "Amount", "Status", "Reference", ""]} empty={!list.length && "No payments match."}>
        {list.map((p) => {
          const acts = nextActions(p);
          return (
            <tr key={`${p.kind}:${p.id}`} tabIndex={0} onClick={() => setOpenKey(`${p.kind}:${p.id}`)} onKeyDown={(ev) => ev.key === "Enter" && setOpenKey(`${p.kind}:${p.id}`)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-hover">
              <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(p.created_at)}</td>
              <td className={td}><b>{p.member}</b></td>
              <td className={td}>{p.item}<span className="block text-[12px] text-faint">{KIND_LABEL[p.kind]} · {p.space === "House" ? "VentureWeavers" : p.space}</span></td>
              <td className={`${td} text-muted`}>{METHOD_LABEL[p.method] ?? p.method}</td>
              <td className={`${td} whitespace-nowrap text-right font-bold`}>{formatEGP(p.amount_piasters)}</td>
              <td className={td}><StatusPill tone={statusTone(p.status)}>{statusLabel(p.status)}</StatusPill></td>
              <td className={`${td} font-mono text-[12px] text-muted`}>{p.reference}</td>
              <td className={`${td} text-right whitespace-nowrap`} onClick={(ev) => ev.stopPropagation()}>
                {acts.includes("paid") ? <Button size="sm" variant="secondary" onClick={() => setConfirm({ row: p, action: "paid" })}>Mark paid</Button> : null}
              </td>
            </tr>
          );
        })}
      </TableBox>
      <p className="text-[12.5px] text-faint">Bank transfers are matched by reference and marked paid here. Card, wallet and Fawry payments will confirm on their own once Paymob is live.</p>

      <Drawer
        open={sel !== null}
        onClose={() => setOpenKey(null)}
        eyebrow={sel ? KIND_LABEL[sel.kind] : ""}
        title={sel?.item ?? ""}
        footer={
          sel ? (
            <>
              {nextActions(sel).map((a) => (
                <Button key={a} variant={a === "paid" ? "primary" : "secondary"} disabled={r.pending} onClick={() => setConfirm({ row: sel, action: a })}>{ACTION_LABEL[a]}</Button>
              ))}
              {sel.kind === "request" && sel.status === "pending" ? (
                <Button variant="ghost" disabled={r.pending} onClick={() => r.run(() => sendRequestEmail(sel.id))}><Mail size={15} aria-hidden="true" />Email again</Button>
              ) : null}
            </>
          ) : null
        }
      >
        {sel ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={statusTone(sel.status)}>{statusLabel(sel.status)}</StatusPill>
              <ThreadTag thread={sel.space} />
              {sel.kind === "request" ? (
                <span className="ml-auto flex gap-1">
                  {sel.status === "pending" ? <IconBtn label="Edit request" onClick={() => { r.setError(null); setEdit(sel); }}><Pencil size={15} aria-hidden="true" /></IconBtn> : null}
                  <IconBtn label="Duplicate request" onClick={() => r.run(() => duplicateRequest(sel.id))}><Copy size={15} aria-hidden="true" /></IconBtn>
                  {sel.status === "pending" || sel.status === "cancelled" ? <IconBtn label="Delete request" onClick={() => setDel(sel)}><Trash2 size={15} aria-hidden="true" /></IconBtn> : null}
                </span>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <Item label="Member" value={sel.member} sub={sel.email ?? undefined} />
              <Item label="Amount" value={formatEGP(sel.amount_piasters)} />
              <Item label="Reference" value={sel.reference} mono />
              <Item label="Method" value={METHOD_LABEL[sel.method] ?? sel.method} />
              <Item label="Created" value={formatDateTime(sel.created_at)} />
              <Item label="Paid" value={sel.paid_at ? formatDateTime(sel.paid_at) : "—"} sub={sel.marked_by ? `Marked by ${admins[sel.marked_by] ?? "an admin"}` : undefined} />
              {sel.kind === "request" && details[sel.id]?.due_on ? <Item label="Due" value={formatDate(details[sel.id].due_on!)} /> : null}
            </dl>
            {sel.kind === "request" && details[sel.id]?.note ? <p className="rounded-lg bg-soft p-3 text-[13px] whitespace-pre-line">{details[sel.id].note}</p> : null}
            {sel.status === "paid" ? <p className="text-[12.5px] text-faint">Refunds are full refunds for now. Send the money back by bank transfer first, then mark it refunded here.</p> : null}
          </>
        ) : null}
      </Drawer>

      <EditorDrawer open={edit !== null} onClose={() => setEdit(null)} eyebrow="Payments" title={e ? `Edit ${e.reference}` : "New payment request"} pending={r.pending} error={r.error} formKey={e?.id ?? "new"} onSubmit={(fd) => r.run(() => saveRequest(fd), () => setEdit(null))}>
        {e ? <input type="hidden" name="id" value={e.id} /> : null}
        {e ? (
          <p className="text-[13px]">For <b>{e.member}</b></p>
        ) : (
          <SelectField label="Member" name="member_id" required defaultValue="" options={[{ value: "", label: members.length ? "Choose a member" : "No members yet" }, ...members.map((m) => ({ value: m.id, label: `${m.name} · ${m.email}` }))]} hint="Requests go to members with an account. They see it in My space › Payments." />
        )}
        <TextField label="What it's for" name="item" defaultValue={e?.item ?? ""} required maxLength={120} placeholder="Growth diagnostic · 2 weeks" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Amount (EGP)" name="amount" inputMode="decimal" defaultValue={e ? String(e.amount_piasters / 100) : ""} required placeholder="15000" />
          <SelectField label="Space" name="space" defaultValue={e?.space ?? "BRICKR"} options={[{ value: "BRICKR", label: "BRICKR" }, { value: "Outloud", label: "Outloud" }, { value: "TVS", label: "TVS" }, { value: "QuidQuo", label: "QuidQuo" }, { value: "House", label: "VentureWeavers" }]} />
        </div>
        <TextField label="Due date (optional)" name="due_on" type="date" defaultValue={ed?.due_on ?? ""} />
        <TextArea label="Note to the member (optional)" name="note" rows={3} maxLength={500} defaultValue={ed?.note ?? ""} />
        {!e ? <p className="text-[12.5px] text-faint">The member gets an email with the amount, the bank details and a VWP- reference.</p> : null}
      </EditorDrawer>

      <ConfirmDelete name={del?.reference} open={del !== null} onClose={() => setDel(null)} pending={r.pending} note="Only pending or cancelled requests can be deleted." onConfirm={() => del && r.run(() => deleteRequest(del.id), () => { setDel(null); setOpenKey(null); })} />

      <ConfirmAction
        state={confirm}
        pending={r.pending}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && r.run(() => changePayment(confirm.row.kind, confirm.row.id, confirm.action), () => setConfirm(null))}
      />
    </>
  );
}

function Item({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-faint">{label}</dt>
      <dd className={cn("truncate font-bold", mono && "font-mono text-[12.5px]")}>{value}</dd>
      {sub ? <dd className="truncate text-[12px] text-faint">{sub}</dd> : null}
    </div>
  );
}

function ConfirmAction({ state, pending, onClose, onConfirm }: { state: { row: LedgerRow; action: "paid" | "cancel" | "refund" } | null; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  const text = state
    ? {
        paid: `Confirm that ${formatEGP(state.row.amount_piasters)} arrived with reference ${state.row.reference}. ${state.row.kind === "request" ? "The member gets a receipt." : state.row.kind === "seat" ? "The member's seat is confirmed and they're emailed." : "The learner is enrolled and emailed."}`,
        cancel: `Cancel ${state.row.reference}? ${state.row.kind === "seat" ? "The seats go back on sale." : state.row.kind === "program" ? "The program seat is released." : "The member no longer owes it."}`,
        refund: `Mark ${formatEGP(state.row.amount_piasters)} as refunded in full? ${state.row.kind === "request" ? "" : state.row.kind === "seat" ? "The booking is cancelled and the seats go back on sale." : "The learner is removed from the cohort."}`,
      }[state.action]
    : "";
  return (
    <ModalLite open={state !== null} title={state ? ACTION_LABEL[state.action] : ""} onClose={onClose} onConfirm={onConfirm} pending={pending} confirmLabel={state ? ACTION_LABEL[state.action] : ""}>
      <p className="text-[13.5px]">{text}</p>
    </ModalLite>
  );
}

function ModalLite({ open, title, onClose, onConfirm, pending, confirmLabel, children }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void; pending: boolean; confirmLabel: string; children: React.ReactNode }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Back</Button>
          <Button disabled={pending} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
