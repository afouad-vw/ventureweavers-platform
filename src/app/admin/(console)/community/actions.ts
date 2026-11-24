"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { isUuid } from "@/lib/blong/format";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** Mark a report handled or dismissed (or reopen it), with an optional note for the team. */
export async function handleReport(id: string, status: "open" | "handled" | "dismissed", note: string): Promise<Result> {
  const admin = await requireAdmin("community.manage");
  if (!isUuid(id) || !["open", "handled", "dismissed"].includes(status)) return { ok: false, error: "Unknown report." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_handle_report", { p_id: id, p_status: status, p_note: note.trim().slice(0, 1000) || null });
  if (error) return { ok: false, error: error.message.includes("not_admin") ? "You can view reports but not handle them." : "Couldn't update the report." };
  await audit(admin.userId, `report.${status}`, "reports", { entityId: id, after: { status, note: note.trim() || null } }).catch(() => null);
  revalidatePath("/admin/community");
  return { ok: true };
}

/** Archive or restore a community (staff). The owner is told when the team archives it. */
export async function setCommunityStatusAdmin(id: string, status: "active" | "archived"): Promise<Result> {
  const admin = await requireAdmin("community.manage");
  if (!isUuid(id) || !["active", "archived"].includes(status)) return { ok: false, error: "Unknown community." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_community_status", { p_id: id, p_status: status });
  if (error) return { ok: false, error: "Couldn't change the community." };
  await audit(admin.userId, `community.${status}`, "communities", { entityId: id, after: { status } }).catch(() => null);
  revalidatePath("/admin/community");
  return { ok: true };
}
