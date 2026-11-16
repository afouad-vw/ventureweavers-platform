"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/form-state";
import { parseAbout } from "@/lib/profile/about";
import { TOPICS } from "@/lib/profile/options";
import { createClient } from "@/lib/supabase/server";

const topicSet = new Set<string>(TOPICS);

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { error: "Please sign in again." };
  const parsed = parseAbout((k) => form.get(k), (k) => form.getAll(k));
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase
    .from("profiles")
    .update({
      ...parsed.value,
      interests: [...new Set(form.getAll("topics").map(String).filter((t) => topicSet.has(t)))],
      consent_push: form.get("push") === "on",
    })
    .eq("id", id);
  if (error) return { error: "We couldn't save your changes. Please try again." };
  const { error: bizError } = await supabase.rpc("set_my_businesses", { p_list: parsed.businesses });
  if (bizError) return { error: "We saved your details but couldn't save your businesses. Please check them and try again." };
  revalidatePath("/my-space");
  return { message: "Saved." };
}
