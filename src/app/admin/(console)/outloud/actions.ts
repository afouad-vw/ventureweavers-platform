"use server";

import { revalidatePath } from "next/cache";
import { namesOf, parseList, parseOutline, parsePeople } from "@/lib/details";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { cairoLocalToISO, EVENT_TYPES, slugify, toPiasters, type EventType, MASTERCLASS_FORMATS } from "@/lib/events/format";
import { sendBookingConfirmed } from "@/lib/email/booking";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const BANNER_PREFIX = () => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/event-banners/`;

const refresh = () => {
  revalidatePath("/admin/outloud", "layout");
  revalidatePath("/outloud", "layout");
  revalidatePath("/my-space");
  revalidatePath("/admin/tvs", "layout");
  revalidatePath("/tvs", "layout");
  revalidatePath("/", "page");
};

async function uniqueSlug(base: string, exceptId?: string) {
  const supabase = await createClient();
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { data } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Create or update an event from the editor drawer. */
export async function saveEvent(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  const type = s("type") as EventType;
  if (type !== "masterclass" && !EVENT_TYPES.some((t) => t.value === type)) return { ok: false, error: "Choose a type." };
  const format = type === "masterclass" ? (MASTERCLASS_FORMATS as readonly string[]).includes(s("format")) ? s("format") : "Online" : null;
  const meetUrl = s("meet_url");
  if (meetUrl && !/^https:\/\/[^\s<>"]+$/.test(meetUrl)) return { ok: false, error: "The Meet link must start with https://" };
  const title = s("title");
  if (title.length < 3) return { ok: false, error: "Add a title (at least 3 characters)." };

  let starts_at: string | null = null;
  let price_piasters: number | null = null;
  try {
    starts_at = s("starts_at") ? cairoLocalToISO(s("starts_at")) : null;
    price_piasters = toPiasters(s("price"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (type !== "private_session" && !starts_at) return { ok: false, error: "Add a date and time." };
  const capacity = Number(s("capacity") || 0);
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 10000) return { ok: false, error: "Capacity must be a whole number." };
  const banner = (BANNER_OPTIONS as readonly string[]).includes(s("banner")) ? s("banner") : "Stage";
  const status = s("status") === "published" ? "published" : "draft";
  const banner_url = s("banner_url") || null;
  if (banner_url && !banner_url.startsWith(BANNER_PREFIX())) return { ok: false, error: "That banner image isn't from the upload folder." };
  const storage = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/`;
  const brochure_url = s("brochure_url") || null;
  if (brochure_url && !(brochure_url.startsWith(storage + "brochures/") && brochure_url.endsWith(".pdf"))) return { ok: false, error: "That brochure isn't from the upload folder." };
  let gallery: string[] = [];
  try {
    const g = JSON.parse(s("gallery") || "[]");
    gallery = Array.isArray(g) ? g.map(String).filter((u) => u.startsWith(storage + "event-gallery/")).slice(0, 12) : [];
  } catch {
    gallery = [];
  }
  let ends_at: string | null = null;
  try {
    ends_at = s("ends_at") ? cairoLocalToISO(s("ends_at")) : null;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (ends_at && starts_at && ends_at < starts_at) return { ok: false, error: "The end time is before the start time." };
  const host_list = parsePeople(s("host_list"));
  const guest_list = parsePeople(s("guest_list"));
  const short = s("short_description").replace(/\s+/g, " ").slice(0, 300);

  const row = {
    title: title.slice(0, 140),
    type,
    starts_at,
    venue: format === "Online" ? "Online" : s("venue").slice(0, 160) || null,
    capacity,
    price_piasters,
    hosts: namesOf(host_list).slice(0, 160) || null,
    guest: namesOf(guest_list).slice(0, 160) || null,
    host_list,
    guest_list,
    short_description: short,
    description: (s("details") || short).slice(0, 4000) || null,
    details: s("details").slice(0, 20000),
    audience: s("audience").replace(/\s+/g, " ").slice(0, 300),
    outline: parseOutline(s("outline")),
    prerequisites: parseList(s("prerequisites")),
    activities: parseList(s("activities")),
    ends_at,
    brochure_url,
    gallery,
    banner,
    banner_url,
    status,
    space: type === "masterclass" ? "TVS" : "Outloud",
    format,
  };

  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That event no longer exists." };
    // Don't let capacity drop below seats already taken.
    const { data: left } = await supabase.rpc("event_seats_left", { p_event: id });
    const taken = before.capacity - (typeof left === "number" ? left : 0);
    if (capacity < taken) return { ok: false, error: `${taken} seats are already taken. Capacity can't be lower than that.` };
    const { error } = await supabase.from("events").update(row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save. Please try again." };
    await saveMeetLink(supabase, id, meetUrl);
    await audit(admin.userId, "event.update", "events", { entityId: id, before, after: { ...row, meet_url: meetUrl || null } });
  } else {
    const slug = await uniqueSlug(slugify(title));
    const { data, error } = await supabase.from("events").insert({ ...row, slug, created_by: admin.userId }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't create the event. Please try again." };
    await saveMeetLink(supabase, data.id, meetUrl);
    await audit(admin.userId, "event.create", "events", { entityId: data.id, after: { ...row, meet_url: meetUrl || null } });
  }
  refresh();
  const noun = type === "masterclass" ? "Masterclass" : "Event";
  return { ok: true, message: id ? `${noun} saved` : `${noun} created` };
}

/** The Meet link lives in its own table so only confirmed ticket holders can read it. */
async function saveMeetLink(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, url: string) {
  if (url) await supabase.from("event_links").upsert({ event_id: eventId, meet_url: url });
  else await supabase.from("event_links").delete().eq("event_id", eventId);
}

export async function duplicateEvent(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: e } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!e) return { ok: false, error: "That event no longer exists." };
  const title = `${e.title} (copy)`.slice(0, 140);
  const copy = {
    title,
    slug: await uniqueSlug(slugify(title)),
    type: e.type,
    starts_at: e.starts_at,
    venue: e.venue,
    capacity: e.capacity,
    price_piasters: e.price_piasters,
    hosts: e.hosts,
    guest: e.guest,
    description: e.description,
    short_description: e.short_description,
    details: e.details,
    audience: e.audience,
    outline: e.outline,
    prerequisites: e.prerequisites,
    activities: e.activities,
    host_list: e.host_list,
    guest_list: e.guest_list,
    ends_at: e.ends_at,
    brochure_url: e.brochure_url,
    banner: e.banner,
    banner_url: e.banner_url,
    status: "draft",
    created_by: admin.userId,
  };
  const { data, error } = await supabase.from("events").insert(copy).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't duplicate the event." };
  await audit(admin.userId, "event.duplicate", "events", { entityId: data.id, after: { from: id } });
  refresh();
  return { ok: true, message: "Duplicated as a draft" };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: before } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23503" ? "This event has bookings, so it can't be deleted. Set it to Draft to hide it." : "Couldn't delete the event." };
  }
  await audit(admin.userId, "event.delete", "events", { entityId: id, before });
  refresh();
  return { ok: true, message: "Event deleted" };
}

export async function setEventStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't change the status." };
  await audit(admin.userId, `event.${status === "published" ? "publish" : "unpublish"}`, "events", { entityId: id });
  refresh();
  return { ok: true, message: status === "published" ? "Published" : "Moved to drafts" };
}

const bookingErrors: Record<string, string> = {
  sold_out: "Those seats have been taken since the reservation expired.",
  already_booked: "This member already has another active booking for the event.",
  not_payable: "This booking can't be marked as paid.",
  not_cancellable: "This booking is already closed.",
  forbidden: "Your admin session has ended. Sign in again.",
};
const explain = (msg: string) => bookingErrors[Object.keys(bookingErrors).find((k) => msg.includes(k)) ?? ""] ?? "Something went wrong. Please try again.";

export async function markPaid(bookingId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_paid", { p_booking: bookingId });
  if (error) return { ok: false, error: explain(error.message) };

  // Let the member know (best effort).
  const { data: b } = await supabase
    .from("bookings")
    .select("member_id, seats, events(title, starts_at, venue), tickets(code)")
    .eq("id", bookingId)
    .maybeSingle();
  if (b) {
    const { data: u } = await createServiceClient().auth.admin.getUserById(b.member_id as string);
    const ev = b.events as unknown as { title: string; starts_at: string | null; venue: string | null } | null;
    const t = b.tickets as unknown as { code: string } | null;
    if (u?.user?.email && ev && t) await sendBookingConfirmed(u.user.email, { code: t.code, seats: b.seats as number, event: ev }).catch(() => {});
  }
  refresh();
  return { ok: true, message: "Marked as paid. The member has been emailed." };
}

export async function cancelBooking(bookingId: string, refund: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_booking", { p_booking: bookingId, p_refund: refund });
  if (error) return { ok: false, error: explain(error.message) };
  refresh();
  return { ok: true, message: refund ? "Cancelled and marked refunded" : "Booking cancelled" };
}

export type CheckInResult = {
  result: "ok" | "already" | "unpaid" | "not_found" | "cancelled" | "expired" | "refunded";
  name?: string;
  seats?: number;
  event?: string;
  code?: string;
  checked_in_at?: string;
};

export async function checkIn(code: string): Promise<CheckInResult | { error: string }> {
  await requireAdmin();
  const clean = code.trim().toUpperCase();
  if (!/^VW-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) return { result: "not_found", code: clean };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_check_in", { p_code: clean });
  if (error) return { error: explain(error.message) };
  return data as CheckInResult;
}

export async function saveSettings(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  for (const key of ["bank_details", "refund_policy"] as const) {
    const value = String(form.get(key) ?? "").slice(0, 2000);
    const { error } = await supabase.from("site_settings").update({ value, updated_by: admin.userId, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) return { ok: false, error: "Couldn't save the settings." };
  }
  await audit(admin.userId, "settings.update", "site_settings", { after: { keys: ["bank_details", "refund_policy"] } });
  revalidatePath("/admin/payments");
  refresh();
  return { ok: true, message: "Payment details saved" };
}
