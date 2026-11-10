import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BLOG_COLS, CONTENT_COLS, POST_COLS, RESOURCE_COLS, type BlogPost, type ContentItem, type PostRow, type Resource } from "./queries";

export type AdminResource = Resource & { file_path: string | null; file_name: string | null; file_size: number | null; link_url: string | null };
export type AdminTopic = { id: string; text: string; status: "new" | "picked" | "archived"; created_at: string; member: string };
export type PublishEntry = { id: number; title: string; channels: string[]; audience: string; emails_sent: number; emails_failed: number; sent_at: string; by: string };

export async function adminPosts(): Promise<PostRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLS).order("published_at", { ascending: false }).limit(300);
  return (data ?? []) as PostRow[];
}

export async function adminContent(): Promise<ContentItem[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("content_items").select(CONTENT_COLS).order("publish_on", { ascending: false }).limit(300);
  return (data ?? []) as ContentItem[];
}

export async function adminBlog(): Promise<BlogPost[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select(BLOG_COLS).order("published_on", { ascending: false }).limit(300);
  return (data ?? []) as BlogPost[];
}

export async function adminLibrary(): Promise<AdminResource[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const [{ data: rows }, { data: targets }] = await Promise.all([
    supabase.from("library_resources").select(RESOURCE_COLS).order("created_at", { ascending: false }).limit(300),
    supabase.rpc("admin_resource_targets"),
  ]);
  const t = new Map(((targets ?? []) as { id: string; file_path: string | null; file_name: string | null; file_size: number | null; link_url: string | null }[]).map((x) => [x.id, x]));
  return ((rows ?? []) as Resource[]).map((r) => ({ ...r, file_path: null, file_name: null, file_size: null, link_url: null, ...t.get(r.id) }));
}

async function names(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Member"]));
}

export async function adminTopics(): Promise<AdminTopic[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("topic_suggestions").select("id, text, status, created_at, member_id").order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as (Omit<AdminTopic, "member"> & { member_id: string })[];
  const n = await names(Array.from(new Set(rows.map((r) => r.member_id))));
  return rows.map(({ member_id, ...r }) => ({ ...r, member: n.get(member_id) ?? "Member" }));
}

export async function adminPublishLog(): Promise<PublishEntry[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("publish_log").select("id, title, channels, audience, emails_sent, emails_failed, sent_at, sent_by").order("sent_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as (Omit<PublishEntry, "by"> & { sent_by: string | null })[];
  const { data: admins } = await createServiceClient().from("admin_users").select("user_id, display_name");
  const a = new Map(((admins ?? []) as { user_id: string; display_name: string }[]).map((x) => [x.user_id, x.display_name]));
  return rows.map(({ sent_by, ...r }) => ({ ...r, by: (sent_by && a.get(sent_by)) || "Admin" }));
}

/** Members who ticked The Floor Notes and have a confirmed email address. */
export async function newsletterRecipients(): Promise<{ id: string; email: string }[]> {
  if (!supabaseConfigured) return [];
  const svc = createServiceClient();
  const { data: opted } = await svc.from("profiles").select("id").eq("consent_newsletter", true).limit(10000);
  const want = new Set(((opted ?? []) as { id: string }[]).map((p) => p.id));
  if (!want.size) return [];
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (want.has(u.id) && u.email && u.email_confirmed_at) out.push({ id: u.id, email: u.email });
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function newsletterCount(): Promise<number> {
  if (!supabaseConfigured) return 0;
  const { count } = await createServiceClient().from("profiles").select("id", { count: "exact", head: true }).eq("consent_newsletter", true);
  return count ?? 0;
}
