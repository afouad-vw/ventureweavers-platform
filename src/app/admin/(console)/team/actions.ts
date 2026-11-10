"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { cleanPerms } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const USERNAME = /^[a-z0-9._-]{3,32}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const refresh = () => revalidatePath("/admin/team");

function explain(message: string | undefined, fallback: string) {
  const m = message ?? "";
  if (m.includes("not_super")) return "Only Ahmed and Karim can manage the team.";
  if (m.includes("username_taken")) return "That username is taken. Choose another.";
  if (m.includes("bad_username")) return "Usernames use 3 to 32 lowercase letters, numbers, dots, dashes or underscores.";
  if (m.includes("bad_name")) return "Add a name (2 to 80 characters).";
  if (m.includes("not_team_member")) return "Super admins can't be changed here.";
  if (m.includes("already_admin")) return "That person is already on the team.";
  return fallback;
}

/** Invite a team member: they get the admin invite email (2-hour link) and set their own password. */
export async function addTeamMember(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("super");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const perms = cleanPerms(form.getAll("perms"));
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Add a name (2 to 80 characters)." };
  if (!USERNAME.test(username)) return { ok: false, error: "Usernames use 3 to 32 lowercase letters, numbers, dots, dashes or underscores." };
  if (!EMAIL.test(email)) return { ok: false, error: "That email doesn't look right." };
  if (!perms.length) return { ok: false, error: "Tick at least one area." };

  const svc = createServiceClient();
  const { data: taken } = await svc.from("admin_users").select("user_id").eq("username", username).maybeSingle();
  if (taken) return { ok: false, error: "That username is taken. Choose another." };

  const { data: invited, error: inviteError } = await svc.auth.admin.inviteUserByEmail(email, { data: { name } });
  if (inviteError || !invited?.user) {
    const exists = /already|registered|exists/i.test(inviteError?.message ?? "");
    return { ok: false, error: exists ? "That email already has an account (maybe a member account). Use a work email that isn't signed up yet." : "Couldn't send the invite. Try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_team_add", { p_user: invited.user.id, p_username: username, p_display: name, p_perms: perms });
  if (error) {
    await svc.auth.admin.deleteUser(invited.user.id).catch(() => {});
    return { ok: false, error: explain(error.message, "Couldn't add the team member.") };
  }
  await audit(admin.userId, "team.invite", "admin_users", { entityId: invited.user.id });
  refresh();
  return { ok: true, message: `Invite sent to ${email}` };
}

export async function updateTeamMember(form: FormData): Promise<ActionResult> {
  await requireAdmin("super");
  const id = String(form.get("id") ?? "");
  if (!ID.test(id)) return { ok: false, error: "Unknown team member." };
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const perms = cleanPerms(form.getAll("perms"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_team_update", { p_user: id, p_display: name, p_perms: perms });
  if (error) return { ok: false, error: explain(error.message, "Couldn't save the access.") };
  refresh();
  return { ok: true, message: "Access saved. It applies on their next click." };
}

export async function pauseTeamMember(id: string, pause: boolean): Promise<ActionResult> {
  await requireAdmin("super");
  if (!ID.test(id)) return { ok: false, error: "Unknown team member." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_team_pause", { p_user: id, p_pause: pause });
  if (error) return { ok: false, error: explain(error.message, "Couldn't change it.") };
  refresh();
  return { ok: true, message: pause ? "Access paused. They're signed out." : "Access restored" };
}

export async function removeTeamMember(id: string): Promise<ActionResult> {
  await requireAdmin("super");
  if (!ID.test(id)) return { ok: false, error: "Unknown team member." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_team_remove", { p_user: id });
  if (error) return { ok: false, error: explain(error.message, "Couldn't remove them.") };
  // Remove their sign-in too; if records still point at it, block sign-in instead.
  const svc = createServiceClient();
  const { error: delError } = await svc.auth.admin.deleteUser(id);
  if (delError) await svc.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  refresh();
  return { ok: true, message: "Removed from the team" };
}

/** Send the invite again to someone who hasn't set their password yet. */
export async function resendTeamInvite(id: string): Promise<ActionResult> {
  await requireAdmin("super");
  if (!ID.test(id)) return { ok: false, error: "Unknown team member." };
  const svc = createServiceClient();
  const { data: row } = await svc.from("admin_users").select("is_super").eq("user_id", id).maybeSingle();
  if (!row || row.is_super) return { ok: false, error: "Unknown team member." };
  const { data: u } = await svc.auth.admin.getUserById(id);
  const email = u?.user?.email;
  if (!email) return { ok: false, error: "No email on this account." };
  if (u?.user?.last_sign_in_at) return { ok: false, error: "They've already signed in. Use Send password reset on the admin sign-in page instead." };
  const { error } = await svc.auth.admin.inviteUserByEmail(email);
  if (error) return { ok: false, error: "Couldn't resend the invite. Try again in a minute." };
  refresh();
  return { ok: true, message: `Invite sent again to ${email}` };
}
