"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import type { Perm } from "@/lib/auth/permissions";
import { allAuthUsers } from "@/lib/contacts/queries";
import { createClient } from "@/lib/supabase/server";
import { isWaitType, type WaitItemType } from "@/lib/waitlist";

type Result = { ok: true; message: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MANAGE: Record<WaitItemType, readonly Perm[]> = { service: ["brickr.manage"], program: ["tvs.manage"], event: ["events.manage", "tvs.manage"] };

function refresh() {
  revalidatePath("/admin", "layout");
}

/** Adds a member (by their account email) to an item's waitlist. The database checks the admin's area. */
export async function addToWaitlist(type: string, id: string, email: string): Promise<Result> {
  if (!isWaitType(type) || !ID.test(id)) return { ok: false, error: "Unknown item." };
  const admin = await requireAdmin(MANAGE[type]);
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(e)) return { ok: false, error: "Enter the member's email address." };
  const user = (await allAuthUsers()).find((u) => u.email?.toLowerCase() === e);
  if (!user) return { ok: false, error: "No member has that email. They need to join first." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_add_to_waitlist", { p_type: type, p_id: id, p_member: user.id });
  if (error) {
    if (error.message.includes("not_member")) return { ok: false, error: "That's a team account, not a member." };
    if (error.message.includes("not_admin")) return { ok: false, error: "You can't change this list." };
    return { ok: false, error: "Couldn't add them." };
  }
  await audit(admin.userId, "waitlist.add", "waitlist_entries", { entityId: id, after: { type, member: user.id } });
  refresh();
  return { ok: true, message: data ? "Added to the list" : "They're already on the list" };
}

/** Removes someone from a waitlist. */
export async function removeFromWaitlist(type: string, id: string, memberId: string): Promise<Result> {
  if (!isWaitType(type) || !ID.test(id) || !ID.test(memberId)) return { ok: false, error: "Unknown item." };
  const admin = await requireAdmin(MANAGE[type]);
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").delete().eq("item_type", type).eq("item_id", id).eq("member_id", memberId);
  if (error) return { ok: false, error: "Couldn't remove them." };
  await audit(admin.userId, "waitlist.remove", "waitlist_entries", { entityId: id, before: { type, member: memberId } });
  refresh();
  return { ok: true, message: "Removed from the list" };
}
