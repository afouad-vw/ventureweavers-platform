"use server";

import { revalidatePath } from "next/cache";
import { bookingError, MAX_SEATS } from "@/lib/events/format";
import { sendBookingReceived } from "@/lib/email/booking";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type BookResult =
  | { ok: true; code: string; payReference: string; seats: number; amountPiasters: number; holdExpiresAt: string | null; status: "reserved" | "confirmed" }
  | { ok: false; error: string };

export async function bookEvent(eventId: string, seats: number): Promise<BookResult> {
  if (!supabaseConfigured) return { ok: false, error: "Booking isn't switched on yet." };
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) return { ok: false, error: bookingError("seat_limit") };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: bookingError("not_signed_in") };

  const { data, error } = await supabase.rpc("book_event", { p_event: eventId, p_seats: seats });
  if (error || !data) return { ok: false, error: bookingError(error?.message ?? "") };
  const r = data as { code: string; pay_reference: string; seats: number; amount_piasters: number; hold_expires_at: string | null; status: "reserved" | "confirmed" };

  // The email is a courtesy; the booking stands even if sending fails.
  const email = claims.claims.email as string | undefined;
  if (email) {
    const { data: ev } = await supabase.from("events").select("title, starts_at, venue").eq("id", eventId).maybeSingle();
    if (ev) await sendBookingReceived(email, { ...r, event: ev }).catch(() => {});
  }

  revalidatePath("/outloud");
  revalidatePath("/my-space");
  return { ok: true, code: r.code, payReference: r.pay_reference, seats: r.seats, amountPiasters: r.amount_piasters, holdExpiresAt: r.hold_expires_at, status: r.status };
}

export async function cancelMyBooking(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Not available yet." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_booking", { p_booking: bookingId });
  if (error) return { ok: false, error: bookingError(error.message) };
  revalidatePath("/my-space");
  revalidatePath("/outloud");
  return { ok: true };
}
