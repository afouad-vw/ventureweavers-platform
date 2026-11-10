"use server";

import { revalidatePath } from "next/cache";
import { slotToISO } from "@/lib/brickr/slots";
import { alertPartners, sendRequestReceived } from "@/lib/email/brickr";
import { esc } from "@/lib/email/send";
import { formatDateTime } from "@/lib/events/format";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function signedIn() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub as string | undefined;
  return sub ? { supabase, id: sub, email: (data?.claims?.email as string | undefined) ?? null } : null;
}

/** BRICKR (and Outloud private sessions): request a 30-minute intro call at a preferred time. */
export async function requestMeeting(form: FormData): Promise<Result> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "Sign in to request a meeting." };
  const serviceId = String(form.get("service_id") ?? "");
  if (!ID.test(serviceId)) return { ok: false, error: "Choose a service." };
  const at = slotToISO(String(form.get("day") ?? ""), String(form.get("slot") ?? ""));
  if (!at) return { ok: false, error: "Choose one of the days and times shown." };
  const company = String(form.get("company") ?? "").trim().slice(0, 160);
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);

  const { error } = await s.supabase.from("requests").insert({ service_id: serviceId, preferred_at: at, company, note });
  if (error) {
    const m = error.message;
    if (m.includes("too_many_open")) return { ok: false, error: "You have 5 open requests. We'll be in touch on those first." };
    if (m.includes("request_limit")) return { ok: false, error: "That's a lot of requests today. Please try again tomorrow." };
    if (m.includes("service_closed")) return { ok: false, error: "This service isn't taking requests right now." };
    return { ok: false, error: "Couldn't send your request. Please try again." };
  }
  const { data: sv } = await s.supabase.from("services").select("name").eq("id", serviceId).maybeSingle();
  const service = sv?.name ?? "a meeting";
  if (s.email) await sendRequestReceived(s.email, { service, preferred_at: at }).catch(() => null);
  const { data: p } = await s.supabase.from("profiles").select("full_name").eq("id", s.id).maybeSingle();
  await alertPartners(`New request: ${service}`, [
    `<b>${esc(p?.full_name || s.email || "A member")}</b>${company ? ` (${esc(company)})` : ""} asked for <b>${esc(service)}</b>, preferably ${esc(formatDateTime(at))}.`,
    note ? `“${esc(note)}”` : "No note.",
  ], "/requests").catch(() => null);
  revalidatePath("/my-space");
  return { ok: true, message: "Request sent. Track it in My space › Requests." };
}

export async function withdrawRequest(id: string): Promise<Result> {
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  const s = await signedIn();
  if (!s) return { ok: false, error: "Sign in again." };
  const { data, error } = await s.supabase.from("requests").delete().eq("id", id).eq("member_id", s.id).eq("status", "new").select("id");
  if (error || !data?.length) return { ok: false, error: "This request has moved on; write to us to change it." };
  revalidatePath("/my-space");
  return { ok: true, message: "Request withdrawn" };
}
