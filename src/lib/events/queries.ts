import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus, EventType } from "./format";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  type: EventType;
  starts_at: string | null;
  venue: string | null;
  capacity: number;
  price_piasters: number | null;
  hosts: string | null;
  guest: string | null;
  description: string | null;
  banner: string;
  banner_url: string | null;
  status: "draft" | "published";
  created_at: string;
  space: string;
  format: string | null;
};

/** Meet links for events where the member holds a confirmed ticket (row level security returns only those). */
export async function myMeetLinks(): Promise<Map<string, string>> {
  if (!supabaseConfigured) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("event_links").select("event_id, meet_url");
  return new Map(((data ?? []) as { event_id: string; meet_url: string | null }[]).filter((x) => x.meet_url).map((x) => [x.event_id, x.meet_url!]));
}

export type EventWithSeats = EventRow & { seats_left: number };

export type MyBooking = {
  id: string;
  seats: number;
  amount_piasters: number;
  status: BookingStatus;
  pay_reference: string;
  hold_expires_at: string | null;
  created_at: string;
  events: Pick<EventRow, "id" | "slug" | "title" | "type" | "starts_at" | "venue"> | null;
  tickets: { code: string; checked_in_at: string | null } | null;
};

const EVENT_COLS = "id, slug, title, type, starts_at, venue, capacity, price_piasters, hosts, guest, description, banner, banner_url, status, created_at, space, format";

async function withSeats(rows: EventRow[]): Promise<EventWithSeats[]> {
  const supabase = await createClient();
  return Promise.all(
    rows.map(async (e) => {
      const { data } = await supabase.rpc("event_seats_left", { p_event: e.id });
      return { ...e, seats_left: typeof data === "number" ? data : 0 };
    }),
  );
}

/**
 * Published events from now on, soonest first; private sessions (no date) last.
 * "outloud" leaves out masterclasses, "masterclasses" keeps only those, "all" keeps everything.
 */
export async function listUpcomingEvents(which: "outloud" | "masterclasses" | "all" = "outloud"): Promise<EventWithSeats[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select(EVENT_COLS)
    .eq("status", "published")
    .or(`starts_at.gte.${new Date().toISOString()},type.eq.private_session`);
  if (which === "outloud") q = q.neq("type", "masterclass");
  if (which === "masterclasses") q = q.eq("type", "masterclass");
  const { data } = await q.order("starts_at", { ascending: true, nullsFirst: false }).limit(50);
  return withSeats((data ?? []) as EventRow[]);
}

export async function getEventBySlug(slug: string): Promise<EventWithSeats | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_COLS).eq("slug", slug).maybeSingle();
  if (!data) return null;
  return (await withSeats([data as EventRow]))[0];
}

/** The signed-in member's bookings, newest first. Row level security limits this to their own. */
export async function myBookings(): Promise<MyBooking[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, seats, amount_piasters, status, pay_reference, hold_expires_at, created_at, events(id, slug, title, type, starts_at, venue), tickets(code, checked_in_at)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as MyBooking[];
}

/** The member's active booking for each event id, to show "Booked" instead of "Book". */
export async function myActiveEventIds(): Promise<Set<string>> {
  if (!supabaseConfigured) return new Set();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new Set();
  const { data } = await supabase.from("bookings").select("event_id, status, hold_expires_at").in("status", ["reserved", "confirmed"]);
  const now = Date.now();
  return new Set(
    (data ?? [])
      .filter((b) => b.status === "confirmed" || !b.hold_expires_at || new Date(b.hold_expires_at).getTime() > now)
      .map((b) => b.event_id as string),
  );
}

export async function paymentInstructions(): Promise<{ bank_details: string; refund_policy: string }> {
  const fallback = { bank_details: "", refund_policy: "" };
  if (!supabaseConfigured) return fallback;
  const supabase = await createClient();
  const { data } = await supabase.rpc("payment_instructions");
  return { ...fallback, ...((data as Record<string, string> | null) ?? {}) };
}
