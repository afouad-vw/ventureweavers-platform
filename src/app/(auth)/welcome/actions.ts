"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { safeNext } from "@/lib/auth/policy";
import { parseAbout } from "@/lib/profile/about";
import { createClient } from "@/lib/supabase/server";

/** Saves "About you" and continues to where the member was going. */
export async function saveAbout(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/sign-in");
  const parsed = parseAbout((k) => form.get(k), (k) => form.getAll(k));
  if (!parsed.ok) return { error: parsed.error };
  const { data: before } = await supabase.from("profiles").select("onboarded_at").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.value, onboarded_at: before?.onboarded_at ?? new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "We couldn't save your details. Please try again." };
  redirect(safeNext(String(form.get("next") ?? "")));
}
