import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { LedgerRow, PayStatus } from "./format";

export type MemberOption = { id: string; name: string; email: string };

/** Members (not admins) with name and email. Admin pages only. */
export async function memberDirectory(): Promise<MemberOption[]> {
  if (!supabaseConfigured) return [];
  const svc = createServiceClient();
  const [{ data: admins }, { data: profiles }] = await Promise.all([
    svc.from("admin_users").select("user_id"),
    svc.from("profiles").select("id, full_name").limit(20000),
  ]);
  const isAdmin = new Set(((admins ?? []) as { user_id: string }[]).map((a) => a.user_id));
  const names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const out: MemberOption[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (!isAdmin.has(u.id) && u.email) out.push({ id: u.id, email: u.email, name: names.get(u.id) || u.email });
    if (data.users.length < 1000) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every payment, newest first, with the member's name and email. Admin only (the view returns nothing to others). */
export async function adminLedger(): Promise<LedgerRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  await supabase.rpc("expire_holds").then(() => {}, () => {});
  const [{ data }, people] = await Promise.all([
    supabase.from("payments_ledger").select("*").order("created_at", { ascending: false }).limit(5000),
    memberDirectory(),
  ]);
  const who = new Map(people.map((p) => [p.id, p]));
  return ((data ?? []) as Omit<LedgerRow, "member" | "email">[]).map((r) => ({
    ...r,
    member: who.get(r.member_id)?.name ?? "Member",
    email: who.get(r.member_id)?.email ?? null,
  }));
}

export type MyPayment = Pick<LedgerRow, "kind" | "id" | "item" | "space" | "amount_piasters" | "status" | "reference" | "created_at" | "paid_at"> & {
  due_on?: string | null;
  note?: string;
  hold_expires_at?: string | null;
};

/** Everything the signed-in member has paid or owes: seats, program seats and payment requests. */
export async function myPayments(): Promise<MyPayment[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const now = Date.now();
  const [{ data: b }, { data: en }, { data: rq }] = await Promise.all([
    supabase.from("bookings").select("id, seats, amount_piasters, status, pay_reference, hold_expires_at, created_at, events(title, type), payments(paid_at)"),
    supabase.from("enrolments").select("id, amount_piasters, status, pay_reference, offered_at, confirmed_at, refunded_at, cohorts(label, programs(name))"),
    supabase.from("payment_requests").select("id, item, space, amount_piasters, status, reference, created_at, paid_at, due_on, note"),
  ]);
  type B = { id: string; seats: number; amount_piasters: number; status: string; pay_reference: string; hold_expires_at: string | null; created_at: string; events: { title: string; type: string } | null; payments: { paid_at: string | null }[] };
  type E = { id: string; amount_piasters: number; status: string; pay_reference: string; offered_at: string; confirmed_at: string | null; refunded_at: string | null; cohorts: { label: string; programs: { name: string } | null } | null };
  const seats: MyPayment[] = ((b ?? []) as unknown as B[]).filter((x) => x.amount_piasters > 0).map((x) => ({
    kind: "seat",
    id: x.id,
    item: `${x.events?.title ?? "Event"}${x.seats > 1 ? ` · ${x.seats} seats` : ""}`,
    space: x.events?.type === "masterclass" ? "TVS" : "Outloud",
    amount_piasters: x.amount_piasters,
    status: (x.status === "reserved" ? (x.hold_expires_at && new Date(x.hold_expires_at).getTime() > now ? "pending" : "expired") : x.status === "confirmed" ? "paid" : x.status) as PayStatus,
    reference: x.pay_reference,
    created_at: x.created_at,
    paid_at: x.payments?.find((p) => p.paid_at)?.paid_at ?? null,
    hold_expires_at: x.hold_expires_at,
  }));
  const programs: MyPayment[] = ((en ?? []) as unknown as E[]).filter((x) => x.amount_piasters > 0).map((x) => ({
    kind: "program",
    id: x.id,
    item: `${x.cohorts?.programs?.name ?? "Program"} · ${x.cohorts?.label ?? ""}`,
    space: "TVS",
    amount_piasters: x.amount_piasters,
    status: (x.status === "offered" ? "pending" : x.status === "confirmed" ? "paid" : x.refunded_at ? "refunded" : "cancelled") as PayStatus,
    reference: x.pay_reference,
    created_at: x.offered_at,
    paid_at: x.confirmed_at,
  }));
  const requests: MyPayment[] = ((rq ?? []) as (MyPayment & { status: PayStatus })[]).map((x) => ({ ...x, kind: "request" as const }));
  return [...seats, ...programs, ...requests].sort((a, c) => c.created_at.localeCompare(a.created_at));
}
