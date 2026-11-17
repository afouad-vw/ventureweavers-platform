"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { cleanMessage, type Message } from "@/lib/messages/format";
import { adminThread } from "@/lib/messages/queries";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const refresh = () => {
  revalidatePath("/admin/messages", "layout");
  revalidatePath("/admin/contacts", "layout");
};

/** Reply as VentureWeavers. The member gets a notification in their bell. */
export async function replyToThread(threadId: string, raw: string): Promise<Result> {
  await requireAdmin("messages.manage");
  if (!ID.test(threadId)) return { ok: false, error: "Unknown conversation." };
  const body = cleanMessage(raw);
  if (!body) return { ok: false, error: "Write a reply (up to 2,000 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("team_send_message", { p_thread: threadId, p_body: body });
  if (error) return { ok: false, error: error.message.includes("not_admin") ? "You can view messages but not reply." : "The reply didn't send. Try again." };
  refresh();
  return { ok: true };
}

export async function setThreadStatus(threadId: string, status: "open" | "done"): Promise<Result> {
  await requireAdmin("messages.manage");
  if (!ID.test(threadId)) return { ok: false, error: "Unknown conversation." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("team_set_thread_status", { p_thread: threadId, p_status: status });
  if (error) return { ok: false, error: "Couldn't change the conversation." };
  refresh();
  return { ok: true, message: status === "done" ? "Marked as done" : "Reopened" };
}

export async function markThreadRead(threadId: string): Promise<void> {
  await requireAdmin("messages.view");
  if (!ID.test(threadId)) return;
  const supabase = await createClient();
  await supabase.rpc("team_mark_thread_read", { p_thread: threadId });
}

export async function fetchThread(threadId: string): Promise<Message[]> {
  await requireAdmin("messages.view");
  return adminThread(threadId);
}

/** Write to a member from their contact page, starting the conversation if there isn't one yet. */
export async function messageMember(memberId: string, raw: string): Promise<Result> {
  await requireAdmin("messages.manage");
  if (!ID.test(memberId)) return { ok: false, error: "Unknown member." };
  const body = cleanMessage(raw);
  if (!body) return { ok: false, error: "Write a message (up to 2,000 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("team_start_thread", { p_member: memberId, p_body: body });
  if (error) return { ok: false, error: error.message.includes("not_admin") ? "You can view messages but not send them." : "The message didn't send. Try again." };
  refresh();
  return { ok: true, message: "Sent" };
}
