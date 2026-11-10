"use server";

import { getMember } from "@/lib/auth/guards";
import type { Notice } from "@/lib/notifications/format";
import { myNotifications } from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function fetchNotifications(): Promise<Notice[] | null> {
  if (!(await getMember())) return null;
  return myNotifications();
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!ID.test(id) || !(await getMember())) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!(await getMember())) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}
