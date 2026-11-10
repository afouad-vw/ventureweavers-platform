"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { EVENT_URI, INVITEE_URI } from "@/lib/calendly";
import { fetchBooking } from "@/lib/calendly-server";
import { alertPartners } from "@/lib/email/brickr";
import { esc } from "@/lib/email/send";
import { formatDateTime } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Called by the page right after a member books in Calendly: the booking becomes a request in the inbox. */
export async function recordCalendlyBooking(serviceId: string, eventUri: string, inviteeUri: string): Promise<Result> {
  const me = await getMember();
  if (!me) return { ok: false, error: "Sign in again." };
  if (!ID.test(serviceId) || !EVENT_URI.test(eventUri) || !INVITEE_URI.test(inviteeUri) || !inviteeUri.startsWith(eventUri + "/")) {
    return { ok: false, error: "We couldn't read that booking. It's still in Calendly; we'll see it there." };
  }
  // With a Calendly token, read the real time and Meet link from Calendly; otherwise record the booking without them.
  const b = await fetchBooking(eventUri, inviteeUri);
  if (b?.canceled) return { ok: false, error: "That booking was cancelled." };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("record_calendly_booking", {
    p_service: serviceId,
    p_event: eventUri,
    p_invitee: inviteeUri,
    p_start: b?.start ?? null,
    p_join: b?.join ?? null,
    p_note: "Booked in Calendly",
  });
  if (error) {
    if (error.message.includes("too_many_open")) return { ok: true, message: "Booked in Calendly. (You have 5 open requests, so it isn't listed in My space.)" };
    return { ok: true, message: "Booked in Calendly. You'll get the confirmation by email." };
  }
  const { data: sv } = await supabase.from("services").select("name").eq("id", serviceId).maybeSingle();
  await alertPartners(
    `Calendly booking: ${sv?.name ?? "meeting"}`,
    [`<b>${esc(me.name || me.email || "A member")}</b> booked <b>${esc(sv?.name ?? "a meeting")}</b> in Calendly${b?.start ? ` for ${esc(formatDateTime(b.start))}` : ""}.`],
    "/requests",
  ).catch(() => null);
  revalidatePath("/my-space");
  void id;
  return { ok: true, message: "Booked. It's in your calendar and in My space › Requests." };
}
