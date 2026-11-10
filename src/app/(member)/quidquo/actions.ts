"use server";

import { revalidatePath } from "next/cache";
import { alertPartners } from "@/lib/email/brickr";
import { esc } from "@/lib/email/send";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function signedIn() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub as string | undefined;
  return sub ? { supabase, id: sub, email: (data?.claims?.email as string | undefined) ?? null } : null;
}

export async function joinWaitlist(role: string, feedback: boolean, ref: string | null): Promise<Result> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "Sign in to join the waitlist." };
  const { data: before } = await s.supabase.from("waitlist").select("id").eq("member_id", s.id).maybeSingle();
  const { error } = await s.supabase.rpc("join_waitlist", { p_role: role, p_feedback: feedback, p_ref: ref && /^[2-9A-Z]{8}$/.test(ref) ? ref : null });
  if (error) return { ok: false, error: error.message.includes("bad_role") ? "Choose how you'd use QuidQuo." : "Couldn't join. Please try again." };
  if (!before) {
    const { data: p } = await s.supabase.from("profiles").select("full_name").eq("id", s.id).maybeSingle();
    await alertPartners("New on the QuidQuo waitlist", [`<b>${esc(p?.full_name || s.email || "A member")}</b> joined as ${esc(role.toLowerCase())}.`], "/quidquo?tab=waitlist").catch(() => null);
  }
  revalidatePath("/quidquo");
  revalidatePath("/library");
  return { ok: true, message: before ? "Saved" : "You're on the list" };
}

export async function leaveWaitlist(): Promise<Result> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "Sign in again." };
  const { error } = await s.supabase.from("waitlist").delete().eq("member_id", s.id);
  if (error) return { ok: false, error: "Couldn't update that." };
  revalidatePath("/quidquo");
  revalidatePath("/library");
  return { ok: true, message: "You've left the waitlist" };
}
