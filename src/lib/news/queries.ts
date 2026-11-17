import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { NewsStatus } from "./format";

export type NewsSubmission = {
  id: string;
  member_id: string;
  business_name: string;
  news_type: string;
  headline: string;
  news_date: string;
  summary: string;
  details: string;
  link: string | null;
  image_url: string | null;
  preferred: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: NewsStatus;
  decline_note: string | null;
  blog_post_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};
const COLS = "id, member_id, business_name, news_type, headline, news_date, summary, details, link, image_url, preferred, contact_name, contact_email, contact_phone, status, decline_note, blog_post_id, reviewed_at, created_at";

export type Post = { id: string; slug: string; title: string; summary: string; body: string; category: string; author: string; banner_url: string | null; status: string };

/** The member's own submissions, newest first, with the published post's address. */
export async function myNews(): Promise<(NewsSubmission & { href: string | null })[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("news_submissions").select(COLS).order("created_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as NewsSubmission[];
  const ids = rows.filter((r) => r.status === "published" && r.blog_post_id).map((r) => r.blog_post_id!);
  const slugs = new Map<string, string>();
  if (ids.length) {
    const { data: posts } = await supabase.from("blog_posts").select("id, slug").in("id", ids);
    for (const p of (posts ?? []) as { id: string; slug: string }[]) slugs.set(p.id, p.slug);
  }
  return rows.map((r) => ({ ...r, href: r.blog_post_id && slugs.get(r.blog_post_id) ? `/outloud/blog/${slugs.get(r.blog_post_id)}` : null }));
}

export type AdminNews = NewsSubmission & { memberName: string; memberKey: string; post: Post | null; reviewer: string | null };

/** Every submission for the Requests inbox (staff with Requests or Content access, by row level security). */
export async function adminNews(): Promise<AdminNews[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("news_submissions").select(`${COLS}, reviewed_by`).order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as (NewsSubmission & { reviewed_by: string | null })[];
  if (!rows.length) return [];
  const svc = createServiceClient();
  const postIds = rows.map((r) => r.blog_post_id).filter(Boolean) as string[];
  const [{ data: profiles }, { data: posts }, { data: admins }] = await Promise.all([
    svc.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.member_id))]),
    postIds.length ? svc.from("blog_posts").select("id, slug, title, summary, body, category, author, banner_url, status").in("id", postIds) : Promise.resolve({ data: [] }),
    svc.from("admin_users").select("user_id, display_name"),
  ]);
  const name = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const post = new Map(((posts ?? []) as Post[]).map((p) => [p.id, p]));
  const staff = new Map(((admins ?? []) as { user_id: string; display_name: string }[]).map((a) => [a.user_id, a.display_name]));
  return rows.map((r) => ({
    ...r,
    memberName: name.get(r.member_id) || r.contact_name,
    memberKey: `m-${r.member_id}`,
    post: r.blog_post_id ? post.get(r.blog_post_id) ?? null : null,
    reviewer: r.reviewed_by ? staff.get(r.reviewed_by) ?? null : null,
  }));
}
