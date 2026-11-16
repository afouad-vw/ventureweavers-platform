"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { sendMessageAlert } from "@/lib/email/messages";
import { cleanMessage, type Message } from "@/lib/messages/format";
import { myConversation, myUnreadMessages } from "@/lib/messages/queries";
import { createClient } from "@/lib/supabase/server";

export type SendResult = { ok: true } | { ok: false; error: string };

/** A member writes to the VentureWeavers team. The inbox gets an email for new conversations. */
export async function sendMyMessage(raw: string): Promise<SendResult> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Please sign in again." };
  const body = cleanMessage(raw);
  if (!body) return { ok: false, error: "Write a message (up to 2,000 characters)." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", { p_body: body });
  if (error) {
    if (error.message.includes("too_many_messages")) return { ok: false, error: "You've sent a lot of messages in the last hour. Please wait a little and try again." };
    return { ok: false, error: "Your message didn't send. Please try again." };
  }
  const r = data as { thread_id: string; alert: boolean; new: boolean };
  if (r?.alert) {
    await sendMessageAlert({ name: m.name || m.email || "A member", email: m.email ?? null, body, isNew: r.new, threadId: r.thread_id }).catch(() => null);
  }
  revalidatePath("/messages");
  return { ok: true };
}

/** For the 10-second refresh and live updates. */
export async function fetchMyConversation(): Promise<{ threadId: string | null; messages: Message[] } | null> {
  if (!(await getMember())) return null;
  const { thread, messages } = await myConversation();
  return { threadId: thread?.id ?? null, messages };
}

export async function markMyMessagesRead(): Promise<void> {
  if (!(await getMember())) return;
  const supabase = await createClient();
  await supabase.rpc("mark_my_messages_read");
}

export async function fetchUnreadMessages(): Promise<number | null> {
  if (!(await getMember())) return null;
  return myUnreadMessages();
}
