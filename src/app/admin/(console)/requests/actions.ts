"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { adminInbox } from "@/lib/brickr/queries";
import { toCsv } from "@/lib/csv";
import { sendMeetingConfirmed } from "@/lib/email/brickr";
import { cairoLocalToISO, formatDateTime } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { APPLICATION_STATUSES, applicationLabel, type ApplicationStatus } from "@/lib/tvs/format";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function refresh() {
  revalidatePath("/admin/requests", "layout");
  revalidatePath("/admin/brickr", "layout");
  revalidatePath("/my-space");
  revalidatePath("/library");
}

export async function moveRequest(id: string, status: ApplicationStatus): Promise<ActionResult> {
  const admin = await requireAdmin("requests.manage");
  if (!ID.test(id) || !APPLICATION_STATUSES.some((s) => s.value === status)) return { ok: false, error: "Unknown stage." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("requests").select("status").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "That request no longer exists." };
  const { error } = await supabase.from("requests").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't move it." };
  await audit(admin.userId, "request.move", "requests", { entityId: id, before, after: { status } });
  refresh();
  return { ok: true, message: status === "won" ? "Won: they're now a BRICKR client" : `Moved to ${applicationLabel(status)}` };
}

export async function setRequestOwner(id: string, owner: string): Promise<ActionResult> {
  const admin = await requireAdmin("requests.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  const clean = owner.trim().slice(0, 60) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("requests").update({ owner: clean }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't set the owner." };
  await audit(admin.userId, "request.owner", "requests", { entityId: id, after: { owner: clean } });
  refresh();
  return { ok: true, message: clean ? `Owner: ${clean}` : "Owner cleared" };
}

/** Confirm the intro call: time (Cairo) and Meet link. Moves New to Intro call and emails the member. */
export async function confirmMeeting(id: string, whenLocal: string, url: string): Promise<ActionResult> {
  const admin = await requireAdmin("requests.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  let at: string;
  try {
    at = cairoLocalToISO(whenLocal);
  } catch {
    return { ok: false, error: "Choose a date and time." };
  }
  const link = url.trim();
  if (link && !/^https:\/\/[^\s<>"]+$/.test(link)) return { ok: false, error: "The Meet link must start with https://" };
  const supabase = await createClient();
  const { data: r } = await supabase.from("requests").select("member_id, status, services(name)").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "That request no longer exists." };
  const status = r.status === "new" ? "intro_call" : r.status;
  const { error } = await supabase.from("requests").update({ meeting_at: at, meeting_url: link || null, status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the meeting." };
  await audit(admin.userId, "request.confirm", "requests", { entityId: id, after: { meeting_at: at, meeting_url: link || null } });
  const { data: u } = await createServiceClient().auth.admin.getUserById(r.member_id as string);
  const service = (r.services as unknown as { name: string } | null)?.name ?? "Your meeting";
  if (u.user?.email) await sendMeetingConfirmed(u.user.email, { service, meeting_at: at, meeting_url: link || null }).catch(() => null);
  refresh();
  return { ok: true, message: `Confirmed for ${formatDateTime(at)}; the member gets an email` };
}

export async function addRequestNote(id: string, body: string): Promise<ActionResult> {
  const admin = await requireAdmin("requests.manage");
  const text = body.trim();
  if (!ID.test(id) || !text) return { ok: false, error: "Write a note first." };
  const supabase = await createClient();
  const { error } = await supabase.from("request_notes").insert({ request_id: id, body: text.slice(0, 2000), author_id: admin.userId });
  if (error) return { ok: false, error: "Couldn't add the note." };
  refresh();
  return { ok: true, message: "Note added" };
}

export async function deleteRequestNote(noteId: string): Promise<ActionResult> {
  await requireAdmin("requests.manage");
  if (!ID.test(noteId)) return { ok: false, error: "Unknown note." };
  const supabase = await createClient();
  const { error } = await supabase.from("request_notes").delete().eq("id", noteId);
  if (error) return { ok: false, error: "Couldn't delete the note." };
  refresh();
  return { ok: true, message: "Note deleted" };
}

export async function deleteRequest(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("requests.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  const supabase = await createClient();
  const { error } = await supabase.from("requests").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, "request.delete", "requests", { entityId: id });
  refresh();
  return { ok: true, message: "Request deleted" };
}

export async function exportInboxCsv(): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const admin = await requireAdmin("requests.manage");
  const items = await adminInbox();
  await audit(admin.userId, "export", "requests", { after: { rows: items.length } });
  return {
    ok: true,
    csv: toCsv(
      ["Type", "Request", "Space", "Member", "Email", "Company or role", "Note", "Preferred time", "Meeting", "Meet link", "Owner", "Stage", "Received"],
      items.map((i) => [
        i.kind === "request" ? "Meeting request" : "Application",
        i.title,
        i.space,
        i.member,
        i.email,
        i.company,
        i.note,
        i.timing ? formatDateTime(i.timing) : "",
        i.meeting_at ? formatDateTime(i.meeting_at) : "",
        i.meeting_url,
        i.owner,
        applicationLabel(i.status),
        formatDateTime(i.created_at),
      ]),
    ),
  };
}
