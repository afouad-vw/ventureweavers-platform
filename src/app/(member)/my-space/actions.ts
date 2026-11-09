"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/form-state";
import { cleanOnboarding } from "@/lib/profile/options";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { error: "Please sign in again." };
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
  if (!values.full_name) return { error: "Please enter your name." };
  const { error } = await supabase.from("profiles").update(values).eq("id", id);
  if (error) return { error: "We couldn't save your changes. Please try again." };
  revalidatePath("/my-space");
  return { message: "Saved." };
}
