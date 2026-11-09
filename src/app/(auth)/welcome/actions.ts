"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { safeNext } from "@/lib/auth/policy";
import { cleanOnboarding } from "@/lib/profile/options";
import { createClient } from "@/lib/supabase/server";

export async function saveOnboarding(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/sign-in");
  const s = (k: string) => String(form.get(k) ?? "");
  const values = cleanOnboarding({
    name: s("name"),
    phone: s("phone"),
    role: s("role"),
    stage: s("stage"),
    goals: form.getAll("goals").map(String),
    topics: form.getAll("topics").map(String),
    whatsapp: form.get("whatsapp") === "on",
    push: form.get("push") === "on",
    newsletter: form.get("newsletter") === "on",
  });
  const { error } = await supabase
    .from("profiles")
    .update({ ...values, onboarded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "We couldn't save your answers. Please try again." };
  redirect(safeNext(s("next")));
}
