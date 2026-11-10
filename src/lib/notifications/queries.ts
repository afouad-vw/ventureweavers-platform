import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { SHOWN, type Notice } from "./format";

/** The signed-in member's latest notifications (row level security returns only their own). */
export async function myNotifications(): Promise<Notice[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, text, href, created_at, read_at").order("created_at", { ascending: false }).limit(SHOWN);
  return (data ?? []) as Notice[];
}
