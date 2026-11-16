import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { memberUnread, teamUnread, type Message, type Thread } from "./format";

const THREAD_COLS = "id, member_id, status, last_message_at, last_member_message_at, member_read_at, team_read_at";
const MSG_COLS = "id, body, from_team, created_at, author";

/** The member's conversation with the team (row level security keeps it to their own). */
export async function myConversation(): Promise<{ thread: Thread | null; messages: Message[] }> {
  if (!supabaseConfigured) return { thread: null, messages: [] };
  const supabase = await createClient();
  const { data: thread } = await supabase.from("message_threads").select(THREAD_COLS).maybeSingle();
  if (!thread) return { thread: null, messages: [] };
  const { data } = await supabase.from("messages").select(MSG_COLS).eq("thread_id", thread.id).order("created_at", { ascending: false }).limit(200);
  // Members see replies as "VentureWeavers", never who on the team wrote them.
  const messages = ((data ?? []) as Message[]).reverse().map((m) => ({ id: m.id, body: m.body, from_team: m.from_team, created_at: m.created_at, author: null }));
  return { thread: thread as Thread, messages };
}

/** Team replies the member hasn't opened, for the top bar. */
export async function myUnreadMessages(): Promise<number> {
  if (!supabaseConfigured) return 0;
  const supabase = await createClient();
  const { data: thread } = await supabase.from("message_threads").select("id, member_read_at").maybeSingle();
  if (!thread) return 0;
  const q = supabase.from("messages").select("from_team, created_at").eq("thread_id", thread.id).eq("from_team", true);
  const { data } = await (thread.member_read_at ? q.gt("created_at", thread.member_read_at) : q).limit(100);
  return memberUnread((data ?? []) as Pick<Message, "from_team" | "created_at">[], thread.member_read_at);
}

export type InboxThread = Thread & { name: string; email: string | null; avatar: string | null; last: string; unread: boolean };

/** Every conversation for the admin inbox, newest first (staff with the Messages area only). */
export async function adminThreads(): Promise<InboxThread[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data: threads } = await supabase.from("message_threads").select(THREAD_COLS).order("last_message_at", { ascending: false }).limit(300);
  const list = (threads ?? []) as Thread[];
  if (!list.length) return [];
  const svc = createServiceClient();
  const ids = list.map((t) => t.member_id);
  const [{ data: profiles }, lasts, emails] = await Promise.all([
    svc.from("profiles").select("id, full_name, avatar_url").in("id", ids),
    Promise.all(list.map((t) => supabase.from("messages").select("body, from_team").eq("thread_id", t.id).order("created_at", { ascending: false }).limit(1).maybeSingle())),
    Promise.all(ids.map(async (id) => (await svc.auth.admin.getUserById(id)).data.user?.email ?? null)),
  ]);
  const prof = new Map(((profiles ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
  return list.map((t, i) => {
    const last = lasts[i].data as { body: string; from_team: boolean } | null;
    return {
      ...t,
      name: prof.get(t.member_id)?.full_name || emails[i] || "Member",
      email: emails[i],
      avatar: prof.get(t.member_id)?.avatar_url ?? null,
      last: last ? `${last.from_team ? "You: " : ""}${last.body.replace(/\s+/g, " ").slice(0, 120)}` : "",
      unread: teamUnread(t),
    };
  });
}

/** One conversation with who on the team wrote each reply (admin view). */
export async function adminThread(id: string): Promise<Message[]> {
  if (!supabaseConfigured || !/^[0-9a-f-]{36}$/.test(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("messages").select(MSG_COLS).eq("thread_id", id).order("created_at", { ascending: false }).limit(300);
  const rows = ((data ?? []) as (Message & { author: string | null })[]).reverse();
  const authors = [...new Set(rows.filter((r) => r.from_team && r.author).map((r) => r.author!))];
  const names = new Map<string, string>();
  if (authors.length) {
    const { data: admins } = await createServiceClient().from("admin_users").select("user_id, display_name").in("user_id", authors);
    for (const a of (admins ?? []) as { user_id: string; display_name: string }[]) names.set(a.user_id, a.display_name);
  }
  return rows.map((r) => ({ ...r, author: r.from_team ? names.get(r.author ?? "") ?? "Team" : null }));
}

/** How many conversations wait for the team, for the admin menu. */
export async function adminUnreadThreads(): Promise<number> {
  if (!supabaseConfigured) return 0;
  const supabase = await createClient();
  const { data } = await supabase.from("message_threads").select("last_member_message_at, team_read_at").eq("status", "open").limit(500);
  return ((data ?? []) as Pick<Thread, "last_member_message_at" | "team_read_at">[]).filter(teamUnread).length;
}
