"use server";

import { revalidatePath } from "next/cache";
import { ROLES, STAGES } from "@/lib/profile/options";
import { alertPartners } from "@/lib/email/brickr";
import { esc } from "@/lib/email/send";
import { sendApplicationReceived } from "@/lib/email/tvs";
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

/** TVS › Programs › Apply. The partners see it on the Applications board. */
export async function applyToProgram(form: FormData): Promise<Result> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "Sign in to apply." };
  const programId = String(form.get("program_id") ?? "");
  const role = String(form.get("role") ?? "").trim();
  const stage = String(form.get("venture_stage") ?? "").trim();
  const building = String(form.get("building") ?? "").trim().replace(/\s+/g, " ");
  const why = String(form.get("why_now") ?? "").trim().replace(/\s+/g, " ");
  if (!ID.test(programId)) return { ok: false, error: "Choose a program." };
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, error: "Choose what describes you best." };
  if (stage && !STAGES.some(([v]) => v === stage)) return { ok: false, error: "Choose a stage from the list." };
  if (building.length < 10) return { ok: false, error: "Tell us a little more about what you're building (at least 10 characters)." };
  if (building.length > 1000 || why.length > 1000) return { ok: false, error: "Keep each answer under 1,000 characters." };

  const { error } = await s.supabase.from("applications").insert({ program_id: programId, role, venture_stage: stage.slice(0, 80), building, why_now: why });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You've already applied. You'll find it in My space › My learning." };
    if (error.message.includes("program_closed")) return { ok: false, error: "This program isn't taking applications right now." };
    return { ok: false, error: "Couldn't send your application. Please try again." };
  }
  const { data: p } = await s.supabase.from("programs").select("name").eq("id", programId).maybeSingle();
  if (s.email) await sendApplicationReceived(s.email, p?.name ?? "the program").catch(() => null);
  const { data: me } = await s.supabase.from("profiles").select("full_name").eq("id", s.id).maybeSingle();
  await alertPartners(`New application: ${p?.name ?? "TVS"}`, [
    `<b>${esc(me?.full_name || s.email || "A member")}</b> (${esc(role)}${stage ? `, ${esc(stage)}` : ""}) applied to <b>${esc(p?.name ?? "a program")}</b>.`,
    `“${esc(building)}”`,
  ], "/tvs?tab=apps").catch(() => null);
  revalidatePath("/tvs");
  revalidatePath("/my-space");
  return { ok: true, message: "Application sent. We'll be in touch for a short intro call." };
}

/** "Notify me" for programs in development. */
export async function setProgramInterest(programId: string, on: boolean): Promise<Result> {
  if (!ID.test(programId)) return { ok: false, error: "Unknown program." };
  const s = await signedIn();
  if (!s) return { ok: false, error: "Sign in to get notified." };
  const { error } = on
    ? await s.supabase.from("program_interest").upsert({ program_id: programId }, { onConflict: "member_id,program_id", ignoreDuplicates: true })
    : await s.supabase.from("program_interest").delete().eq("program_id", programId);
  if (error) return { ok: false, error: "Couldn't update that. Please try again." };
  revalidatePath("/tvs");
  return { ok: true, message: on ? "We'll tell you when it opens" : "Notifications turned off" };
}
