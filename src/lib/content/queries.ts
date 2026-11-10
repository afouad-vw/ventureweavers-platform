import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AccessLevel, ContentStatus } from "./format";

export type PostRow = {
  id: string;
  space: string;
  kind: string;
  title: string;
  body: string;
  image_url: string | null;
  banner: string | null;
  link_url: string | null;
  link_label: string | null;
  pinned_until: string | null;
  status: "draft" | "published";
  published_at: string;
  created_at: string;
};
export const POST_COLS = "id, space, kind, title, body, image_url, banner, link_url, link_label, pinned_until, status, published_at, created_at";

export type ContentItem = {
  id: string;
  title: string;
  series: string;
  format: string;
  platform: string;
  url: string | null;
  publish_on: string;
  status: ContentStatus;
  image_url: string | null;
};
export const CONTENT_COLS = "id, title, series, format, platform, url, publish_on, status, image_url";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  category: string;
  author: string;
  published_on: string;
  read_time: string;
  summary: string;
  body: string;
  banner: string;
  banner_url: string | null;
  tags: string[];
  status: "draft" | "published";
};
export const BLOG_COLS = "id, slug, title, category, author, published_on, read_time, summary, body, banner, banner_url, tags, status";

export type Resource = {
  id: string;
  title: string;
  kind: string;
  space: string;
  access: AccessLevel;
  description: string;
  ready: boolean;
  status: "draft" | "published";
  created_at: string;
};
/** The columns members may read. Where a resource lives is handed out by open_resource() only. */
export const RESOURCE_COLS = "id, title, kind, space, access, description, ready, status, created_at";

/** Feed for Home: published and due, newest first. Members only (row level security). */
export async function feedPosts(limit = 40): Promise<PostRow[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLS).eq("status", "published").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(limit);
  return (data ?? []) as PostRow[];
}

export async function contentItems(): Promise<ContentItem[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("content_items").select(CONTENT_COLS).in("status", ["published", "scheduled"]).order("publish_on", { ascending: false }).limit(100);
  return (data ?? []) as ContentItem[];
}

export async function blogPosts(): Promise<BlogPost[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select(BLOG_COLS).eq("status", "published").order("published_on", { ascending: false }).limit(100);
  return (data ?? []) as BlogPost[];
}

export async function blogBySlug(slug: string): Promise<BlogPost | null> {
  if (!supabaseConfigured || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select(BLOG_COLS).eq("slug", slug).eq("status", "published").maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export async function libraryResources(): Promise<Resource[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("library_resources").select(RESOURCE_COLS).eq("status", "published").order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as Resource[];
}

export type SavedType = "blog" | "resource" | "post";

/** "type:id" keys of what the member saved, to show the bookmark state. */
export async function mySavedKeys(): Promise<Set<string>> {
  if (!supabaseConfigured) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_items").select("item_type, item_id").limit(500);
  return new Set((data ?? []).map((r) => `${r.item_type}:${r.item_id}`));
}

export type SavedEntry = { type: SavedType; id: string; label: string; title: string; href: string; savedAt: string };

/** Saved items with titles and links, newest first. Items that were unpublished since are left out. */
export async function mySavedEntries(): Promise<SavedEntry[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("saved_items").select("item_type, item_id, created_at").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { item_type: string; item_id: string; created_at: string }[];
  const ids = (t: string) => rows.filter((r) => r.item_type === t).map((r) => r.item_id).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const [blog, res, posts] = await Promise.all([
    ids("blog").length ? supabase.from("blog_posts").select("id, slug, title").in("id", ids("blog")) : Promise.resolve({ data: [] }),
    ids("resource").length ? supabase.from("library_resources").select("id, title, kind").in("id", ids("resource")) : Promise.resolve({ data: [] }),
    ids("post").length ? supabase.from("posts").select("id, title, kind, link_url").in("id", ids("post")) : Promise.resolve({ data: [] }),
  ]);
  const b = new Map(((blog.data ?? []) as { id: string; slug: string; title: string }[]).map((x) => [x.id, x]));
  const r = new Map(((res.data ?? []) as { id: string; title: string; kind: string }[]).map((x) => [x.id, x]));
  const p = new Map(((posts.data ?? []) as { id: string; title: string; kind: string; link_url: string | null }[]).map((x) => [x.id, x]));
  const out: SavedEntry[] = [];
  for (const row of rows) {
    if (row.item_type === "blog" && b.has(row.item_id)) {
      const x = b.get(row.item_id)!;
      out.push({ type: "blog", id: x.id, label: "Blog", title: x.title, href: `/outloud/blog/${x.slug}`, savedAt: row.created_at });
    } else if (row.item_type === "resource" && r.has(row.item_id)) {
      const x = r.get(row.item_id)!;
      out.push({ type: "resource", id: x.id, label: x.kind, title: x.title, href: "/library", savedAt: row.created_at });
    } else if (row.item_type === "post" && p.has(row.item_id)) {
      const x = p.get(row.item_id)!;
      out.push({ type: "post", id: x.id, label: x.kind, title: x.title, href: x.link_url?.startsWith("/") ? x.link_url : "/", savedAt: row.created_at });
    }
  }
  return out;
}

export type HomeProfile = {
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
  stage: string | null;
  goals: string[];
  interests: string[];
  consent_newsletter: boolean;
};

export async function myHomeProfile(id: string): Promise<HomeProfile | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, avatar_url, phone, role, stage, goals, interests, consent_newsletter").eq("id", id).maybeSingle();
  return (data as HomeProfile | null) ?? null;
}
