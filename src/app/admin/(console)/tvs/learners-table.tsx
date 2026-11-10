"use client";

import { useState } from "react";
import { TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/ui/tag";
import { formatDate, formatEGP } from "@/lib/events/format";
import { enrolmentLabel } from "@/lib/tvs/format";
import type { AdminEnrolment } from "@/lib/tvs/queries";
import { cancelEnrolment, confirmEnrolment } from "./actions";

/** Admin › TVS › Learners: everyone offered or enrolled, with payment and cancel. */
export function LearnersTable({ enrolments }: { enrolments: AdminEnrolment[] }) {
  const { pending, run } = useRunner();
  const [ask, setAsk] = useState<{ kind: "paid" | "cancel"; e: AdminEnrolment } | null>(null);
  return (
    <>
      <TableBox minWidth={860} head={["Learner", "Program", "Amount", "Reference", "Status", "Actions"]} empty={!enrolments.length && "No learners yet. Offer a seat from Applications."}>
        {enrolments.map((e) => (
          <tr key={e.id} className={`border-b border-line last:border-b-0 ${e.status === "cancelled" ? "opacity-60" : ""}`}>
            <td className={td}><b className="block">{e.member}</b><span className="text-faint">{e.email ?? ""}</span></td>
            <td className={td}>{e.program} · {e.cohort}<span className="block text-faint">Offered {formatDate(e.offered_at)}</span></td>
            <td className={`${td} whitespace-nowrap`}>{e.amount_piasters === 0 ? "Sponsored" : formatEGP(e.amount_piasters)}</td>
            <td className={`${td} font-mono text-[12.5px]`}>{e.pay_reference}</td>
            <td className={td}><StatusPill tone={e.status === "confirmed" ? "ok" : e.status === "offered" ? "warn" : "draft"}>{enrolmentLabel(e.status)}</StatusPill></td>
            <td className={td}>
              <div className="flex justify-end gap-1.5">
                {e.status === "offered" ? <Button size="sm" onClick={() => setAsk({ kind: "paid", e })}>Mark paid</Button> : null}
                {e.status !== "cancelled" ? <Button size="sm" variant="secondary" onClick={() => setAsk({ kind: "cancel", e })}>Cancel</Button> : null}
              </div>
            </td>
          </tr>
        ))}
      </TableBox>
      <p className="text-[12.5px] text-faint">Progress and Review work for each cohort are in the Classroom tab.</p>
      <Modal
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask?.kind === "paid" ? "Mark this seat paid?" : "Cancel this enrolment?"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsk(null)}>Back</Button>
            <Button
              variant={ask?.kind === "cancel" ? "danger" : "primary"}
              disabled={pending}
              onClick={() => ask && run(() => (ask.kind === "paid" ? confirmEnrolment(ask.e.id) : cancelEnrolment(ask.e.id)), () => setAsk(null))}
            >
              {ask?.kind === "paid" ? "Mark paid" : "Cancel enrolment"}
            </Button>
          </>
        }
      >
        {ask?.kind === "paid" ? (
          <p className="text-[13.5px]">Check the bank transfer of <b>{formatEGP(ask.e.amount_piasters)}</b> with reference <b className="font-mono">{ask.e.pay_reference}</b> arrived. <b>{ask.e.member}</b> is enrolled and gets an email.</p>
        ) : ask ? (
          <p className="text-[13.5px]"><b>{ask.e.member}</b> loses the seat in {ask.e.program} · {ask.e.cohort}, and it becomes free again. Refunds, if any, are handled outside the app for now.</p>
        ) : null}
      </Modal>
    </>
  );
}
