"use server";

import { revalidatePath } from "next/cache";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { audit, requireAdmin } from "@/lib/auth/guards";
import {
  ACCESS_LEVELS,
  AUTHORS,
  BLOG_CATEGORIES,
  CONTENT_FORMATS,
  CONTENT_STATUSES,
  cleanLink,
  isSpace,
  LIBRARY_KINDS,
  parseTags,
  PLATFORMS,
} from "@/lib/content/format";
import { readTime } from "@/lib/content/markdown";
import { newsletterRecipients } from "@/lib/content/admin-queries";
import { unsubscribeUrl } from "@/lib/content/unsubscribe";
import { emailFrame, esc, sendBatch } from "@/lib/email/send";
import { cairoLocalToISO, slugify } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

type Table = "posts" | "content_items" | "blog_posts" | "library_resources";
const NOUN: Record<Table, string> = { posts: "Post", content_items: "Content", blog_posts: "Blog post", library_resources: "Resource" };
const ENTITY: Record<Table, string> = { posts: "post", content_items: "content", blog_posts: "blog", library_resources: "resource" };
const COLS: Record<Table, string> = {
  posts: "id, space, kind, title, body, image_url, banner, link_url, link_label, pinned_until, status, published_at",
  content_items: "id, title, series, format, platform, url, publish_on, status",
  blog_posts: "id, slug, title, category, author, published_on, read_time, summary, body, banner, banner_url, tags, status",
  library_resources: "id, title, kind, space, access, description, status",
};
const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
const STORAGE = () => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/`;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function refresh() {
  for (const p of ["/", "/outloud", "/library", "/my-space"]) revalidatePath(p, "layout");
  for (const p of ["/admin/outloud", "/admin/library", "/admin/publishing", "/admin"]) revalidatePath(p, "layout");
}

const field = (form: FormData) => (k: string) => String(form.get(k) ?? "").trim();
const oneOf = <T extends string>(v: string, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(v) ? (v as T) : fallback);
const imageOk = (url: string) => !url || (url.startsWith(STORAGE() + "content-images/") || url.startsWith(STORAGE() + "event-banners/"));
const dbError = (e: { message?: string; code?: string } | null, fallback: string) =>
  e?.code === "23505" ? "Something with that address already exists." : e?.message?.includes("check") ? "Some of the details aren't allowed. Check the links and lengths." : fallback;

async function uniqueSlug(base: string, exceptId?: string) {
  const supabase = await createClient();
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { data } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------- shared save / duplicate / delete / status

async function save(table: Table, id: string | null, row: Record<string, unknown>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  if (id) {
    if (!ID.test(id)) return { ok: false, error: "Unknown item." };
    const { data: before } = await supabase.from(table).select(COLS[table]).eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That item no longer exists." };
    const { error } = await supabase.from(table).update(row).eq("id", id);
    if (error) return { ok: false, error: dbError(error, "Couldn't save. Please try again.") };
    await audit(admin.userId, `${ENTITY[table]}.update`, table, { entityId: id, before, after: row });
  } else {
    const { data, error } = await supabase.from(table).insert({ ...row, created_by: admin.userId }).select("id").single();
    if (error || !data) return { ok: false, error: dbError(error, "Couldn't create it. Please try again.") };
    await audit(admin.userId, `${ENTITY[table]}.create`, table, { entityId: data.id, after: row });
  }
  refresh();
  return { ok: true, message: id ? `${NOUN[table]} saved` : `${NOUN[table]} created` };
}

async function duplicate(table: Table, id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { data } = await supabase.from(table).select(COLS[table]).eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That item no longer exists." };
  const src = data as unknown as Record<string, unknown>;
  const { id: _drop, ...copy } = src;
  void _drop;
  copy.title = `${String(src.title)} (copy)`.slice(0, 160);
  copy.status = "draft";
  if (table === "blog_posts") copy.slug = await uniqueSlug(slugify(String(copy.title)));
  if (table === "library_resources") {
    // Keep a link, but not an uploaded file: each file belongs to one resource.
    const { data: t } = await supabase.rpc("admin_resource_targets");
    const target = ((t ?? []) as { id: string; link_url: string | null }[]).find((x) => x.id === id);
    copy.link_url = target?.link_url ?? null;
  }
  const { data: made, error } = await supabase.from(table).insert({ ...copy, created_by: admin.userId }).select("id").single();
  if (error || !made) return { ok: false, error: "Couldn't duplicate it." };
  await audit(admin.userId, `${ENTITY[table]}.duplicate`, table, { entityId: made.id, after: { from: id } });
  refresh();
  return { ok: true, message: table === "library_resources" ? "Duplicated as a draft (upload its file again)" : "Duplicated as a draft" };
}

async function remove(table: Table, id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { data: before } = await supabase.from(table).select(COLS[table]).eq("id", id).maybeSingle();
  let filePath: string | null = null;
  if (table === "library_resources") {
    const { data: t } = await supabase.rpc("admin_resource_targets");
    filePath = ((t ?? []) as { id: string; file_path: string | null }[]).find((x) => x.id === id)?.file_path ?? null;
  }
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  if (filePath) await createServiceClient().storage.from("library-files").remove([filePath]);
  // Saved bookmarks pointing at it are no longer useful.
  await createServiceClient().from("saved_items").delete().eq("item_id", id);
  await audit(admin.userId, `${ENTITY[table]}.delete`, table, { entityId: id, before });
  refresh();
  return { ok: true, message: `${NOUN[table]} deleted` };
}

async function setStatus(table: Table, id: string, status: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const allowed = table === "content_items" ? CONTENT_STATUSES.map((s) => s.value) : ["draft", "published"];
  if (!allowed.includes(status as never)) return { ok: false, error: "Unknown status." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't change the status." };
  await audit(admin.userId, `${ENTITY[table]}.status`, table, { entityId: id, after: { status } });
  refresh();
  return { ok: true, message: status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Moved to drafts" };
}

// ---------------------------------------------------------------- feed posts

function postRow(form: FormData): Record<string, unknown> | string {
  const s = field(form);
  const title = s("title");
  if (title.length < 3) return "Add a headline (at least 3 characters).";
  const space = s("space");
  if (!isSpace(space)) return "Choose a space.";
  const link = cleanLink(s("link_url"));
  if (link === "invalid") return "The link must be a page in the app (starting with /) or an https:// address.";
  const image = s("image_url");
  if (!imageOk(image)) return "That image isn't from the upload folder.";
  let pinned_until: string | null = null;
  let published_at: string | null = null;
  try {
    if (form.get("pin") === "on") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s("pinned_until"))) return "Choose until when to pin it.";
      pinned_until = cairoLocalToISO(`${s("pinned_until")}T23:59`);
    }
    published_at = s("published_at") ? cairoLocalToISO(s("published_at")) : null;
  } catch (e) {
    return (e as Error).message;
  }
  return {
    space,
    kind: (s("kind") || "Update").slice(0, 80),
    title: title.slice(0, 160),
    body: s("body").slice(0, 2000),
    image_url: image || null,
    banner: (BANNER_OPTIONS as readonly string[]).includes(s("banner")) ? s("banner") : null,
    link_url: link,
    link_label: link ? (s("link_label") || "Open").slice(0, 40) : null,
    pinned_until,
    status: s("status") === "published" ? "published" : "draft",
    ...(published_at ? { published_at } : {}),
  };
}

export async function savePost(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const row = postRow(form);
  if (typeof row === "string") return { ok: false, error: row };
  return save("posts", String(form.get("id") ?? "") || null, row);
}
export async function duplicatePost(id: string) { return duplicate("posts", id); }
export async function deletePost(id: string) { return remove("posts", id); }
export async function setPostStatus(id: string, status: "draft" | "published") { return setStatus("posts", id, status); }

/** Admin › Publishing › New update: to the Home feed, to The Floor Notes by email, or both. */
export async function publishUpdate(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const toFeed = form.get("ch_feed") === "on";
  const toEmail = form.get("ch_email") === "on";
  if (!toFeed && !toEmail) return { ok: false, error: "Choose at least one channel." };
  const scheduled = String(form.get("published_at") ?? "").trim();
  if (toEmail && scheduled) return { ok: false, error: "Emails go out right away. Clear the time, or send to the feed only." };
  if (toEmail && !process.env.RESEND_API_KEY) return { ok: false, error: "Email isn't switched on yet: add RESEND_API_KEY in Vercel, then try again." };
  form.set("status", toFeed ? "published" : "draft");
  const row = postRow(form);
  if (typeof row === "string") return { ok: false, error: row };
  if (row.published_at && new Date(String(row.published_at)).getTime() < Date.now() - 60000) return { ok: false, error: "That time has passed. Clear it to publish now." };

  const supabase = await createClient();
  const { data: post, error } = await supabase.from("posts").insert({ ...row, created_by: admin.userId }).select("id").single();
  if (error || !post) return { ok: false, error: dbError(error, "Couldn't publish. Please try again.") };

  let sent = 0;
  let failed = 0;
  if (toEmail) {
    const recipients = await newsletterRecipients();
    const link = row.link_url ? String(row.link_url) : null;
    const cta = link ? { label: String(row.link_label || "Open"), href: link.startsWith("/") ? APP + link : link } : { label: "Open VentureWeavers", href: APP };
    const paragraphs = String(row.body).split(/\n{2,}/).filter(Boolean).map((p) => esc(p).replace(/\n/g, "<br>"));
    const r = await sendBatch(
      recipients.map((m) => {
        const unsub = unsubscribeUrl(APP, m.id);
        return {
          to: m.email,
          subject: String(row.title),
          html: emailFrame(String(row.title), paragraphs, cta, `You get this because you chose The Floor Notes. <a href="${esc(unsub)}" style="color:#6b7a78">Unsubscribe</a>`),
          headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        };
      }),
    ).catch(() => ({ sent: 0, failed: recipients.length }));
    sent = r.sent;
    failed = r.failed;
  }

  await supabase.from("publish_log").insert({
    post_id: post.id,
    title: String(row.title),
    channels: [toFeed ? "feed" : null, toEmail ? "email" : null].filter(Boolean),
    audience: toEmail && !toFeed ? "The Floor Notes subscribers" : toEmail ? "All members · The Floor Notes subscribers" : "All members",
    emails_sent: sent,
    emails_failed: failed,
    sent_by: admin.userId,
  });
  await audit(admin.userId, "publish", "posts", { entityId: post.id, after: { feed: toFeed, email: toEmail, sent, failed } });
  refresh();
  const parts = [toFeed ? (row.published_at ? "Scheduled for the feed" : "Posted to the feed") : null, toEmail ? `emailed to ${sent} member${sent === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}` : null].filter(Boolean);
  return { ok: true, message: parts.join(", ").replace(/^./, (c) => c.toUpperCase()) };
}

// ---------------------------------------------------------------- digital content

export async function saveContent(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  if (s("title").length < 3) return { ok: false, error: "Add a title (at least 3 characters)." };
  const url = s("url");
  if (url && !/^https:\/\/[^\s<>"]+$/.test(url)) return { ok: false, error: "The link must start with https://" };
  const status = oneOf(s("status"), CONTENT_STATUSES.map((x) => x.value), "draft");
  if (status === "published" && !url) return { ok: false, error: "Add the link before publishing (or set it to Scheduled)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s("publish_on"))) return { ok: false, error: "Choose a publish date." };
  return save("content_items", s("id") || null, {
    title: s("title").slice(0, 160),
    series: (s("series") || "The Question").slice(0, 60),
    format: oneOf(s("format"), CONTENT_FORMATS, "Short"),
    platform: oneOf(s("platform"), PLATFORMS, "Instagram"),
    url: url || null,
    publish_on: s("publish_on"),
    status,
  });
}
export async function duplicateContent(id: string) { return duplicate("content_items", id); }
export async function deleteContent(id: string) { return remove("content_items", id); }
export async function setContentStatus(id: string, status: "draft" | "scheduled" | "published") { return setStatus("content_items", id, status); }

// ---------------------------------------------------------------- blog

export async function saveBlog(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  const id = s("id") || null;
  const title = s("title");
  if (title.length < 3) return { ok: false, error: "Add a title (at least 3 characters)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s("published_on"))) return { ok: false, error: "Choose a date." };
  const image = s("banner_url");
  if (!imageOk(image)) return { ok: false, error: "That banner image isn't from the upload folder." };
  const body = String(form.get("body") ?? "").slice(0, 60000);
  const wanted = slugify(s("slug") || title);
  if (!wanted) return { ok: false, error: "Add a title with letters or numbers." };
  return save("blog_posts", id, {
    slug: await uniqueSlug(wanted, id ?? undefined),
    title: title.slice(0, 160),
    category: oneOf(s("category"), BLOG_CATEGORIES, "Article"),
    author: oneOf(s("author"), AUTHORS, "Fouad & Karim"),
    published_on: s("published_on"),
    read_time: (s("read_time") || readTime(body)).slice(0, 20),
    summary: s("summary").slice(0, 400),
    body,
    banner: oneOf(s("banner"), BANNER_OPTIONS, "Pattern"),
    banner_url: image || null,
    tags: parseTags(s("tags")),
    status: s("status") === "published" ? "published" : "draft",
  });
}
export async function duplicateBlog(id: string) { return duplicate("blog_posts", id); }
export async function deleteBlog(id: string) { return remove("blog_posts", id); }
export async function setBlogStatus(id: string, status: "draft" | "published") { return setStatus("blog_posts", id, status); }

// ---------------------------------------------------------------- Library

export async function saveResource(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = field(form);
  const id = s("id") || null;
  if (s("title").length < 3) return { ok: false, error: "Add a title (at least 3 characters)." };
  const source = s("source");
  const link = s("link_url");
  const filePath = s("file_path");
  if (source === "link" && link && !/^https:\/\/[^\s<>"]+$/.test(link)) return { ok: false, error: "The link must start with https://" };
  if (filePath && !/^\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(filePath)) return { ok: false, error: "That file isn't from the upload folder." };

  const target =
    source === "link"
      ? { file_path: null, file_name: null, file_size: null, link_url: link || null }
      : { file_path: filePath || null, file_name: filePath ? s("file_name").slice(0, 200) || "file" : null, file_size: filePath ? Number(s("file_size")) || null : null, link_url: null };

  // When the file changes or is removed, delete the old one from storage after saving.
  let oldFile: string | null = null;
  if (id) {
    const supabase = await createClient();
    const { data: t } = await supabase.rpc("admin_resource_targets");
    oldFile = ((t ?? []) as { id: string; file_path: string | null }[]).find((x) => x.id === id)?.file_path ?? null;
  }
  const r = await save("library_resources", id, {
    title: s("title").slice(0, 160),
    kind: oneOf(s("kind"), LIBRARY_KINDS, "Guide"),
    space: isSpace(s("space")) ? s("space") : "House",
    access: oneOf(s("access"), ACCESS_LEVELS.map((a) => a.value), "all_members"),
    description: s("description").slice(0, 600),
    ...target,
    status: s("status") === "published" ? "published" : "draft",
  });
  if (r.ok && oldFile && oldFile !== target.file_path) await createServiceClient().storage.from("library-files").remove([oldFile]);
  return r;
}
export async function duplicateResource(id: string) { return duplicate("library_resources", id); }
export async function deleteResource(id: string) { return remove("library_resources", id); }
export async function setResourceStatus(id: string, status: "draft" | "published") { return setStatus("library_resources", id, status); }

/** Open a Library file from the admin console (any level, drafts too) through a 5-minute link. */
export async function previewResource(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_resource", { p_id: id });
  if (error || !data) return { ok: false, error: error?.message.includes("no_file") ? "No file or link yet." : "Couldn't open it." };
  const r = data as { file_path: string | null; file_name: string | null; link_url: string | null };
  if (r.link_url) return { ok: true, url: r.link_url };
  const { data: signed } = await createServiceClient().storage.from("library-files").createSignedUrl(r.file_path!, 300, { download: r.file_name || true });
  return signed?.signedUrl ? { ok: true, url: signed.signedUrl } : { ok: false, error: "Couldn't prepare the download." };
}

// ---------------------------------------------------------------- topic suggestions

export async function setTopicStatus(id: string, status: "new" | "picked" | "archived"): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id) || !["new", "picked", "archived"].includes(status)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { error } = await supabase.from("topic_suggestions").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the topic." };
  await audit(admin.userId, "topic.status", "topic_suggestions", { entityId: id, after: { status } });
  revalidatePath("/admin/outloud", "layout");
  return { ok: true, message: status === "picked" ? "Marked as picked" : status === "archived" ? "Archived" : "Moved back to new" };
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { error } = await supabase.from("topic_suggestions").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the topic." };
  await audit(admin.userId, "topic.delete", "topic_suggestions", { entityId: id });
  revalidatePath("/admin/outloud", "layout");
  return { ok: true, message: "Topic deleted" };
}
