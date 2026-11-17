"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { readTime } from "@/lib/content/markdown";
import { NEWS_SECTIONS } from "@/lib/news/format";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IMG = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/content-images\/[A-Za-z0-9/_.-]+\.(jpg|jpeg|png|webp)$/;

function refresh() {
  revalidatePath("/admin/requests", "layout");
  revalidatePath("/admin/outloud", "layout");
  revalidatePath("/outloud", "layout");
  revalidatePath("/my-space");
}

/** Save the team's edit as a draft post, or publish it (`publish`). */
export async function saveNews(form: FormData, publish: boolean): Promise<Result> {
  const admin = await requireAdmin("content.manage");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id");
  if (!ID.test(id)) return { ok: false, error: "Unknown submission." };
  const title = s("title").replace(/\s+/g, " ").slice(0, 160);
  if (title.length < 3) return { ok: false, error: "Add a headline (at least 3 characters)." };
  const summary = s("summary").slice(0, 400);
  const body = s("body").replace(/\r\n/g, "\n").slice(0, 40000);
  if (publish && (!summary || !body)) return { ok: false, error: "Add a summary and the text before publishing." };
  const section = (NEWS_SECTIONS as readonly string[]).includes(s("section")) ? s("section") : "Newsletter";
  const banner = s("banner_url");
  if (banner && !IMG.test(banner)) return { ok: false, error: "That image can't be used. Remove it and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_news_save", {
    p_id: id,
    p_title: title,
    p_summary: summary,
    p_body: body,
    p_section: section,
    p_author: s("author").slice(0, 120),
    p_banner_url: banner || null,
    p_publish: publish,
  });
  if (error) {
    if (error.message.includes("not_admin")) return { ok: false, error: "You need Content (manage) access to edit and publish news." };
    if (error.message.includes("declined")) return { ok: false, error: "This submission was declined." };
    if (error.message.includes("blog_posts_slug")) return { ok: false, error: "A post with a very similar headline exists. Change the headline a little." };
    return { ok: false, error: "Couldn't save. Please try again." };
  }
  const postId = (data as { post_id?: string } | null)?.post_id;
  if (postId) await supabase.from("blog_posts").update({ read_time: readTime(body) }).eq("id", postId);
  await audit(admin.userId, publish ? "news.publish" : "news.draft", "news_submissions", { entityId: id, after: { title, section, post: postId } });
  refresh();
  return { ok: true, message: publish ? "Published. The member has been told." : "Draft saved" };
}

export async function declineNews(id: string, note: string): Promise<Result> {
  const admin = await requireAdmin("content.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown submission." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_news_decline", { p_id: id, p_note: note.trim().slice(0, 500) });
  if (error) return { ok: false, error: error.message.includes("published") ? "It's already published. Unpublish the post from Outloud › Blog instead." : error.message.includes("not_admin") ? "You need Content (manage) access to decline news." : "Couldn't decline it. Please try again." };
  await audit(admin.userId, "news.decline", "news_submissions", { entityId: id, after: { note } });
  refresh();
  return { ok: true, message: "Declined. The member has been told." };
}
