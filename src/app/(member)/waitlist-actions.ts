"use server";

import { revalidatePath } from "next/cache";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isWaitType } from "@/lib/waitlist";

type Result = { ok: true; message: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** "Notify me" on a Coming soon service, program or event. The database checks the item is Coming soon and visible. */
export async function setWaitlist(type: string, id: string, on: boolean): Promise<Result> {
  if (!isWaitType(type) || !ID.test(id)) return { ok: false, error: "Unknown item." };
  if (!supabaseConfigured) return { ok: false, error: "Sign in to get notified." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub as string | undefined;
  if (!me) return { ok: false, error: "Sign in to get notified." };
  if (on) {
    const { error } = await supabase.from("waitlist_entries").insert({ item_type: type, item_id: id });
    if (error && error.code !== "23505") {
      if (error.message.includes("waitlist_limit")) return { ok: false, error: "You've joined a lot of lists today. Try again tomorrow." };
      if (error.message.includes("not_coming_soon")) return { ok: false, error: "This is already open, or no longer available. Refresh the page." };
      return { ok: false, error: "Couldn't add you. Please try again." };
    }
  } else {
    const { error } = await supabase.from("waitlist_entries").delete().eq("item_type", type).eq("item_id", id).eq("member_id", me);
    if (error) return { ok: false, error: "Couldn't update that. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: on ? "You're on the list. We'll tell you when it opens." : "You've left the list." };
}
