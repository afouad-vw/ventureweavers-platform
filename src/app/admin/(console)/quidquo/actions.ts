"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { adminWaitlist } from "@/lib/brickr/queries";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROLES = ["Founder raising capital", "Investor or angel", "Ecosystem partner"];

function refresh() {
  revalidatePath("/quidquo");
  revalidatePath("/library");
  revalidatePath("/admin/quidquo", "layout");
}

async function write(table: string, id: string | null, row: Record<string, unknown>, noun: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  if (id) {
    if (!ID.test(id)) return { ok: false, error: "Unknown item." };
    const { error } = await supabase.from(table).update(row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save." };
    await audit(admin.userId, `${table}.update`, table, { entityId: id, after: row });
  } else {
    const { data, error } = await supabase.from(table).insert(row).select("id").single();
    if (error || !data) return { ok: false, error: error?.code === "23505" ? "That email is already on the list." : "Couldn't add it." };
    await audit(admin.userId, `${table}.create`, table, { entityId: data.id, after: row });
  }
  refresh();
  return { ok: true, message: id ? `${noun} saved` : `${noun} added` };
}

async function remove(table: string, id: string, noun: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, `${table}.delete`, table, { entityId: id });
  refresh();
  return { ok: true, message: `${noun} removed` };
}

export async function saveStage(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  if (s("name").length < 2) return { ok: false, error: "Add a name." };
  const progress = Number(s("progress") || 0);
  const position = Number(s("position") || 1);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { ok: false, error: "Progress is a whole number from 0 to 100." };
  return write("qq_stages", s("id") || null, { name: s("name").slice(0, 60), description: s("description").slice(0, 300), progress, position: Number.isInteger(position) ? Math.max(1, Math.min(50, position)) : 1 }, "Stage");
}
export async function deleteStage(id: string) { return remove("qq_stages", id, "Stage"); }

export async function saveLog(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  if (s("title").length < 3) return { ok: false, error: "Add a title." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s("entry_date"))) return { ok: false, error: "Choose a date." };
  return write("qq_log", s("id") || null, { title: s("title").slice(0, 160), body: s("body").slice(0, 1000), entry_date: s("entry_date"), status: s("status") === "published" ? "published" : "draft" }, "Entry");
}
export async function duplicateLog(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!ID.test(id)) return { ok: false, error: "Unknown entry." };
  const supabase = await createClient();
  const { data } = await supabase.from("qq_log").select("entry_date, title, body").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That entry no longer exists." };
  return write("qq_log", null, { ...data, title: `${data.title} (copy)`.slice(0, 160), status: "draft" }, "Entry");
}
export async function setLogStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  const r = await write("qq_log", id, { status }, "Entry");
  return r.ok ? { ok: true, message: status === "published" ? "Published" : "Moved to drafts" } : r;
}
export async function deleteLog(id: string) { return remove("qq_log", id, "Entry"); }

export async function addToWaitlist(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const email = s("email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Add a valid email." };
  if (!ROLES.includes(s("role"))) return { ok: false, error: "Choose a role." };
  return write("waitlist", null, { name: s("name").slice(0, 120) || null, email, role: s("role"), feedback_calls: form.get("feedback_calls") === "on" }, "Person");
}
export async function removeFromWaitlist(id: string) { return remove("waitlist", id, "Person"); }

export async function exportWaitlistCsv(): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const rows = await adminWaitlist();
  await audit(admin.userId, "export", "waitlist", { after: { rows: rows.length } });
  return {
    ok: true,
    csv: toCsv(["Name", "Email", "Joined as", "Feedback calls", "Invited by", "Member account", "Joined"], rows.map((w) => [w.name, w.email, w.role, w.feedback_calls ? "Yes" : "No", w.invited_by, w.member ? "Yes" : "No", formatDate(w.joined_at)])),
  };
}
