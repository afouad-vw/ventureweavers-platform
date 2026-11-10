"use server";

import { revalidatePath } from "next/cache";
import { parseList } from "@/lib/details";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { parseTags } from "@/lib/content/format";
import { slugify } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COLS = "id, slug, name, space, audience, format, description, tags, banner, banner_url, status, sort, short_description, offerings, prerequisites, brochure_url";
const STORAGE = () => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/`;

function refresh() {
  revalidatePath("/brickr");
  revalidatePath("/outloud");
  revalidatePath("/admin/brickr", "layout");
}

async function uniqueSlug(base: string, exceptId?: string) {
  const supabase = await createClient();
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { data } = await supabase.from("services").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function saveService(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("brickr.manage");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  if (id && !ID.test(id)) return { ok: false, error: "Unknown service." };
  if (s("name").length < 2) return { ok: false, error: "Add a name." };
  const banner_url = s("banner_url") || null;
  if (banner_url && !banner_url.startsWith(STORAGE() + "content-images/") && !banner_url.startsWith(STORAGE() + "event-banners/")) return { ok: false, error: "That banner image isn't from the upload folder." };
  const short = s("short_description").replace(/\s+/g, " ");
  if (!short) return { ok: false, error: "Add a short description (shown on the card)." };
  if (short.length > 300) return { ok: false, error: "Keep the short description under 300 characters." };
  const brochure_url = s("brochure_url") || null;
  if (brochure_url && !(brochure_url.startsWith(STORAGE() + "brochures/") && brochure_url.endsWith(".pdf"))) return { ok: false, error: "That brochure isn't from the upload folder." };
  const sort = Number(s("sort") || 100);
  const row = {
    name: s("name").slice(0, 100),
    space: s("space") === "Outloud" || s("space") === "TVS" ? s("space") : "BRICKR",
    audience: s("audience").replace(/\s+/g, " ").slice(0, 300) || "Founders",
    format: s("format").slice(0, 80),
    short_description: short,
    description: short,
    offerings: parseList(s("offerings")),
    prerequisites: parseList(s("prerequisites")),
    brochure_url,
    tags: parseTags(s("tags")),
    banner: (BANNER_OPTIONS as readonly string[]).includes(s("banner")) ? s("banner") : "Round",
    banner_url,
    status: s("status") === "published" ? "published" : "draft",
    sort: Number.isInteger(sort) ? Math.max(0, Math.min(1000, sort)) : 100,
  };
  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("services").select(COLS).eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That service no longer exists." };
    const { error } = await supabase.from("services").update(row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save." };
    await audit(admin.userId, "service.update", "services", { entityId: id, before, after: row });
  } else {
    const { data, error } = await supabase.from("services").insert({ ...row, slug: await uniqueSlug(slugify(row.name)), created_by: admin.userId }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't create the service." };
    await audit(admin.userId, "service.create", "services", { entityId: data.id, after: row });
  }
  refresh();
  return { ok: true, message: id ? "Service saved" : "Service created" };
}

export async function duplicateService(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("brickr.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown service." };
  const supabase = await createClient();
  const { data } = await supabase.from("services").select(COLS).eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That service no longer exists." };
  const { id: _i, slug: _s, ...copy } = data as Record<string, unknown>;
  void _i;
  void _s;
  const name = `${String(copy.name)} (copy)`.slice(0, 100);
  const { error } = await supabase.from("services").insert({ ...copy, name, status: "draft", slug: await uniqueSlug(slugify(name)), created_by: admin.userId });
  if (error) return { ok: false, error: "Couldn't duplicate it." };
  await audit(admin.userId, "service.duplicate", "services", { entityId: id });
  refresh();
  return { ok: true, message: "Duplicated as a draft" };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("brickr.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown service." };
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? "This service has requests. Set it to Draft instead." : "Couldn't delete it." };
  await audit(admin.userId, "service.delete", "services", { entityId: id });
  refresh();
  return { ok: true, message: "Service deleted" };
}

export async function setServiceStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  const admin = await requireAdmin("brickr.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown service." };
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't change the status." };
  await audit(admin.userId, "service.status", "services", { entityId: id, after: { status } });
  refresh();
  return { ok: true, message: status === "published" ? "Published" : "Moved to drafts" };
}
