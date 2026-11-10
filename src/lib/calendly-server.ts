import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";
import { supabaseConfigured } from "@/lib/supabase/env";
import { EVENT_URI, INVITEE_URI } from "./calendly";

/** Karim's Calendly link from admin settings, or "" when not set. */
export const calendlyUrl = cache(async (): Promise<string> => {
  if (!supabaseConfigured) return "";
  const { data } = await createServiceClient().from("site_settings").select("value").eq("key", "calendly_url").maybeSingle();
  return String(data?.value ?? "");
});

type Booking = { start: string | null; join: string | null; email: string | null; canceled: boolean };

/** Reads the booking from Calendly (needs CALENDLY_TOKEN). Returns null when it can't be confirmed. */
export async function fetchBooking(eventUri: string, inviteeUri: string): Promise<Booking | null> {
  const token = process.env.CALENDLY_TOKEN;
  if (!token || !EVENT_URI.test(eventUri) || !INVITEE_URI.test(inviteeUri) || !inviteeUri.startsWith(eventUri + "/")) return null;
  const get = async (u: string) => {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
    return r?.ok ? ((await r.json()) as { resource?: Record<string, unknown> }).resource ?? null : null;
  };
  const [ev, inv] = await Promise.all([get(eventUri), get(inviteeUri)]);
  if (!ev || !inv) return null;
  const loc = (ev.location ?? {}) as { join_url?: string };
  return {
    start: typeof ev.start_time === "string" ? ev.start_time : null,
    join: typeof loc.join_url === "string" ? loc.join_url : null,
    email: typeof inv.email === "string" ? inv.email : null,
    canceled: inv.status === "canceled" || ev.status === "canceled",
  };
}
