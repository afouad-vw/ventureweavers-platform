import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { BookingStatus } from "./format";
import type { EventRow } from "./queries";

export type AdminEvent = EventRow & { confirmed: number; reserved: number; checkedIn: number; meet_url: string | null };

/** All events with seat counts. Admin only (row level security returns drafts only to admins). */
export async function adminListEvents(which: "outloud" | "masterclasses" = "outloud"): Promise<AdminEvent[]> {
  const supabase = await createClient();
  await supabase.rpc("expire_holds").then(() => {}, () => {});
  const [{ data: events }, { data: bookings }] = await Promise.all([
    (which === "masterclasses"
      ? supabase.from("events").select("*, event_links(meet_url)").eq("type", "masterclass")
      : supabase.from("events").select("*, event_links(meet_url)").neq("type", "masterclass")
    ).order("starts_at", { ascending: false, nullsFirst: true }),
    supabase.from("bookings").select("event_id, seats, status, hold_expires_at, tickets(checked_in_at)").in("status", ["reserved", "confirmed"]),
  ]);
  const now = Date.now();
  return ((events ?? []) as (EventRow & { event_links: { meet_url: string | null } | null })[]).map(({ event_links, ...e }) => {
    const mine = (bookings ?? []).filter((b) => b.event_id === e.id);
    const reserved = mine.filter((b) => b.status === "reserved" && b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now).reduce((n, b) => n + (b.seats as number), 0);
    const confirmed = mine.filter((b) => b.status === "confirmed").reduce((n, b) => n + (b.seats as number), 0);
    const checkedIn = mine.filter((b) => (b.tickets as unknown as { checked_in_at: string | null } | null)?.checked_in_at).reduce((n, b) => n + (b.seats as number), 0);
    return { ...e, confirmed, reserved, checkedIn, meet_url: event_links?.meet_url ?? null };
  });
}

export type AdminBooking = {
  id: string;
  seats: number;
  amount_piasters: number;
  status: BookingStatus;
  pay_reference: string;
  hold_expires_at: string | null;
  created_at: string;
  member_id: string;
  name: string;
  email: string;
  phone: string | null;
  code: string | null;
  checked_in_at: string | null;
  event?: { id: string; title: string; starts_at: string | null } | null;
};

async function decorate(rows: Record<string, unknown>[]): Promise<AdminBooking[]> {
  const supabase = await createClient();
  const ids = [...new Set(rows.map((r) => r.member_id as string))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
  const svc = createServiceClient();
  const emails = new Map<string, string>();
  await Promise.all(ids.map(async (id) => {
    const { data } = await svc.auth.admin.getUserById(id);
    if (data?.user?.email) emails.set(id, data.user.email);
  }));
  return rows.map((r) => {
    const p = (profiles ?? []).find((x) => x.id === r.member_id);
    const t = r.tickets as { code: string; checked_in_at: string | null } | null;
    return {
      id: r.id as string,
      seats: r.seats as number,
      amount_piasters: r.amount_piasters as number,
      status: r.status as BookingStatus,
      pay_reference: r.pay_reference as string,
      hold_expires_at: r.hold_expires_at as string | null,
      created_at: r.created_at as string,
      member_id: r.member_id as string,
      name: p?.full_name || emails.get(r.member_id as string) || "Member",
      email: emails.get(r.member_id as string) ?? "",
      phone: p?.phone ?? null,
      code: t?.code ?? null,
      checked_in_at: t?.checked_in_at ?? null,
      event: (r.events as AdminBooking["event"]) ?? null,
    };
  });
}

export async function adminEventWithBookings(eventId: string) {
  const supabase = await createClient();
  await supabase.rpc("expire_holds", { p_event: eventId }).then(() => {}, () => {});
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return null;
  const { data } = await supabase
    .from("bookings")
    .select("id, seats, amount_piasters, status, pay_reference, hold_expires_at, created_at, member_id, tickets(code, checked_in_at)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return { event: event as EventRow, bookings: await decorate((data ?? []) as Record<string, unknown>[]) };
}

/** Reservations waiting for a bank transfer, oldest deadline first. */
export async function adminPendingPayments() {
  const supabase = await createClient();
  await supabase.rpc("expire_holds").then(() => {}, () => {});
  const { data } = await supabase
    .from("bookings")
    .select("id, seats, amount_piasters, status, pay_reference, hold_expires_at, created_at, member_id, tickets(code, checked_in_at), events(id, title, starts_at)")
    .eq("status", "reserved")
    .order("hold_expires_at", { ascending: true });
  return decorate((data ?? []) as Record<string, unknown>[]);
}

export async function adminRecentPayments(limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, method, amount_piasters, status, reference, paid_at, created_at, bookings(seats, events(title))")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function adminSettings(): Promise<{ bank_details: string; refund_policy: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key, value");
  const out = { bank_details: "", refund_policy: "" };
  for (const r of data ?? []) if (r.key in out) out[r.key as keyof typeof out] = r.value as string;
  return out;
}
