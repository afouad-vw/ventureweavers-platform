"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { toCsv } from "@/lib/csv";
import { sendPaymentReceipt, sendPaymentRequest } from "@/lib/email/payments";
import { toPiasters } from "@/lib/events/format";
import { paymentInstructions } from "@/lib/events/queries";
import { filterLedger, ledgerCsvRows, type PayKind } from "@/lib/payments/format";
import { adminLedger } from "@/lib/payments/queries";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cancelBooking, markPaid as markSeatPaid } from "../outloud/actions";
import { cancelEnrolment, confirmEnrolment } from "../tvs/actions";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SPACES = ["Outloud", "TVS", "BRICKR", "QuidQuo", "House"];

function refresh() {
  revalidatePath("/admin/payments", "layout");
  revalidatePath("/my-space");
}

const known: Record<string, string> = {
  bad_transition: "That change isn't allowed for this payment.",
  not_editable: "Only pending requests can be edited.",
  keep_money_records: "Paid and refunded requests are kept for the records. Cancel or refund instead.",
};
const explain = (m: string | undefined, fallback: string) => Object.entries(known).find(([k]) => (m ?? "").includes(k))?.[1] ?? fallback;

async function emailOf(memberId: string) {
  const { data } = await createServiceClient().auth.admin.getUserById(memberId);
  return data?.user?.email ?? null;
}

/** Create or edit a payment request (members only). New requests are emailed to the member. */
export async function saveRequest(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("payments.manage");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id");
  if (id && !ID.test(id)) return { ok: false, error: "Unknown request." };
  const memberId = s("member_id");
  if (!id && !ID.test(memberId)) return { ok: false, error: "Choose the member." };
  const item = s("item").replace(/\s+/g, " ");
  if (item.length < 2 || item.length > 120) return { ok: false, error: "Say what it's for (2 to 120 characters)." };
  const space = SPACES.includes(s("space")) ? s("space") : "BRICKR";
  let amount: number | null;
  try {
    amount = toPiasters(s("amount"));
  } catch {
    return { ok: false, error: "Enter the amount in EGP, like 15000 or 15000.50." };
  }
  if (!amount || amount < 100) return { ok: false, error: "The amount must be at least EGP 1." };
  const due = s("due_on");
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: "Pick a due date." };
  const note = s("note").slice(0, 500);
  const row = { item, space, amount_piasters: amount, due_on: due || null, note };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("payment_requests").update(row).eq("id", id);
    if (error) return { ok: false, error: explain(error.message, "Couldn't save the request.") };
    await audit(admin.userId, "payment_request.update", "payment_requests", { entityId: id, after: row });
    refresh();
    return { ok: true, message: "Request saved" };
  }
  const { data, error } = await supabase.from("payment_requests").insert({ ...row, member_id: memberId }).select("id, reference").single();
  if (error || !data) return { ok: false, error: "Couldn't create the request." };
  await audit(admin.userId, "payment_request.create", "payment_requests", { entityId: data.id as string, after: row });
  const to = await emailOf(memberId);
  let emailed = false;
  if (to && process.env.RESEND_API_KEY) {
    const { bank_details } = await paymentInstructions();
    emailed = await sendPaymentRequest(to, { ...row, reference: data.reference as string }, bank_details).then(() => true, () => false);
  }
  refresh();
  return { ok: true, message: `Request ${data.reference} created${emailed ? " and emailed" : ""}. It shows in their My space.` };
}

export async function duplicateRequest(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("payments.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  const supabase = await createClient();
  const { data: r } = await supabase.from("payment_requests").select("member_id, item, space, amount_piasters, due_on, note").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "Unknown request." };
  const { data, error } = await supabase.from("payment_requests").insert(r).select("id, reference").single();
  if (error || !data) return { ok: false, error: "Couldn't duplicate the request." };
  await audit(admin.userId, "payment_request.duplicate", "payment_requests", { entityId: data.id as string });
  refresh();
  return { ok: true, message: `Duplicated as ${data.reference}. It isn't emailed until you send it.` };
}

export async function deleteRequest(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("payments.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  const supabase = await createClient();
  const { error } = await supabase.from("payment_requests").delete().eq("id", id);
  if (error) return { ok: false, error: explain(error.message, "Couldn't delete the request.") };
  await audit(admin.userId, "payment_request.delete", "payment_requests", { entityId: id });
  refresh();
  return { ok: true, message: "Request deleted" };
}

/** Email the request (again) to the member. */
export async function sendRequestEmail(id: string): Promise<ActionResult> {
  await requireAdmin("payments.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Email isn't switched on yet (RESEND_API_KEY)." };
  const supabase = await createClient();
  const { data: r } = await supabase.from("payment_requests").select("member_id, item, amount_piasters, reference, due_on, note, status").eq("id", id).maybeSingle();
  if (!r || r.status !== "pending") return { ok: false, error: "Only pending requests can be sent." };
  const to = await emailOf(r.member_id as string);
  if (!to) return { ok: false, error: "This member has no email address." };
  const { bank_details } = await paymentInstructions();
  const ok = await sendPaymentRequest(to, r as never, bank_details).then(() => true, () => false);
  return ok ? { ok: true, message: `Emailed to ${to}` } : { ok: false, error: "The email didn't go through. Try again." };
}

async function requestStatus(id: string, status: "paid" | "cancelled" | "refunded"): Promise<ActionResult> {
  await requireAdmin("payments.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_request_status", { p_request: id, p_status: status });
  if (error) return { ok: false, error: explain(error.message, "Couldn't update the payment.") };
  if (status === "paid") {
    const { data: r } = await supabase.from("payment_requests").select("member_id, item, amount_piasters, reference, due_on, note").eq("id", id).maybeSingle();
    const to = r ? await emailOf(r.member_id as string) : null;
    if (r && to && process.env.RESEND_API_KEY) await sendPaymentReceipt(to, r as never).catch(() => {});
  }
  refresh();
  return { ok: true, message: status === "paid" ? "Marked as paid. A receipt went to the member." : status === "cancelled" ? "Request cancelled" : "Marked as refunded" };
}

/** Mark paid, cancel or refund (full) any payment in the list. */
export async function changePayment(kind: PayKind, id: string, action: "paid" | "cancel" | "refund"): Promise<ActionResult> {
  await requireAdmin("payments.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown payment." };
  let r: ActionResult;
  if (kind === "seat") r = action === "paid" ? await markSeatPaid(id) : await cancelBooking(id, action === "refund");
  else if (kind === "program") {
    if (action === "paid") r = await confirmEnrolment(id);
    else if (action === "cancel") r = await cancelEnrolment(id);
    else {
      const supabase = await createClient();
      const { error } = await supabase.rpc("admin_refund_enrolment", { p_enrolment: id });
      r = error ? { ok: false, error: explain(error.message, "Couldn't refund the seat.") } : { ok: true, message: "Program seat refunded and cancelled" };
    }
  } else r = await requestStatus(id, action === "paid" ? "paid" : action === "cancel" ? "cancelled" : "refunded");
  refresh();
  return r;
}

export async function exportPaymentsCsv(status: string, space: string, q: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const admin = await requireAdmin("payments.manage");
  const rows = filterLedger(await adminLedger(), status, space, q.slice(0, 100));
  await audit(admin.userId, "payments.export", "payments_ledger", { after: { status, space, q, rows: rows.length } });
  const [header, ...body] = ledgerCsvRows(rows);
  return { ok: true, csv: toCsv(header, body) };
}
