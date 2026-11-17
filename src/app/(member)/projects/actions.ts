"use server";

import { revalidatePath } from "next/cache";
import { getMember } from "@/lib/auth/guards";
import { INVITEE_URI, EVENT_URI } from "@/lib/calendly";
import { fetchBooking } from "@/lib/calendly-server";
import { alertPartners } from "@/lib/email/brickr";
import { emailFrame, esc, sendEmail } from "@/lib/email/send";
import { categoryOf, formatMoney, REQUEST_CATEGORIES, TASK_STATUSES } from "@/lib/projects/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Result = { ok: true; message: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;

async function me() {
  const m = await getMember();
  return m ? { m, supabase: await createClient() } : null;
}
function refresh(slug?: string) {
  revalidatePath(slug ? `/projects/${slug}` : "/projects", "layout");
}
async function projectOf(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("projects").select("id, slug, name").eq("id", id).maybeSingle();
  return data as { id: string; slug: string; name: string } | null;
}

/** A client raises a request: extra work or a scope change (quoted), a meeting, a question, a document, or other. */
export async function raiseRequest(form: FormData): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  const projectId = String(form.get("project_id") ?? "");
  const title = String(form.get("title") ?? "").trim().replace(/\s+/g, " ");
  const details = String(form.get("details") ?? "").trim();
  const rawCat = String(form.get("category") ?? "");
  const category = REQUEST_CATEGORIES.some((c) => c.value === rawCat) ? rawCat : "extra_work";
  const preferred = String(form.get("preferred_times") ?? "").trim().slice(0, 300);
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  if (title.length < 3) return { ok: false, error: "Add a short title." };
  const p = await projectOf(s.supabase, projectId);
  if (!p) return { ok: false, error: "That project isn't available." };
  const { error } = await s.supabase.from("project_requests").insert({ project_id: projectId, title: title.slice(0, 160), details: details.slice(0, 4000), category, preferred_times: category === "meeting" ? preferred : "" });
  if (error) return { ok: false, error: error.message.includes("request_limit") ? "You've sent a lot of requests today. Try again tomorrow." : "Couldn't send the request." };
  const cat = categoryOf(category);
  await alertPartners(
    `New ${cat.label.toLowerCase()} request on ${p.name}`,
    [`<b>${esc(s.m.name || s.m.email || "A client")}</b> asked: <b>${esc(title)}</b>.`, details ? esc(details.slice(0, 600)) : "", preferred && category === "meeting" ? `Preferred times: ${esc(preferred)}` : ""].filter(Boolean),
    `/projects/${projectId}?tab=requests`,
  ).catch(() => null);
  refresh(p.slug);
  return { ok: true, message: cat.priced ? "Request sent. The partners will reply with the details and price." : category === "meeting" ? "Request sent. The partners will schedule it and it will show in Meetings." : "Request sent. The partners will get back to you." };
}

/** The client lead approves or declines a quote. */
export async function decideRequest(requestId: string, approve: boolean): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(requestId)) return { ok: false, error: "Unknown request." };
  const { data: r } = await s.supabase.from("project_requests").select("title, price, currency, project_id").eq("id", requestId).maybeSingle();
  const { error } = await s.supabase.rpc("client_decide_request", { p_request: requestId, p_approve: approve });
  if (error) return { ok: false, error: error.message.includes("not_allowed") ? "Only the client lead can decide on quotes." : error.message.includes("not_quoted") ? "This quote was already decided or changed." : "Couldn't save your decision." };
  const p = r ? await projectOf(s.supabase, r.project_id) : null;
  if (r && p) {
    await alertPartners(
      `Quote ${approve ? "approved" : "declined"}: ${r.title}`,
      [`<b>${esc(s.m.name || "The client lead")}</b> ${approve ? "approved" : "declined"} the quote for <b>${esc(r.title)}</b> (${esc(formatMoney(r.price, r.currency))}) on ${esc(p.name)}.`],
      `/projects`,
    ).catch(() => null);
  }
  refresh(p?.slug);
  return { ok: true, message: approve ? "Approved. The partners will schedule the work." : "Declined. The partners have been told." };
}

/** The client lead accepts the proposal. */
export async function acceptProposal(projectId: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  const { error } = await s.supabase.rpc("client_accept_proposal", { p_project: projectId });
  if (error) return { ok: false, error: error.message.includes("not_allowed") ? "Only the client lead can accept the proposal." : "It's already accepted, or there's no proposal yet." };
  const p = await projectOf(s.supabase, projectId);
  if (p) await alertPartners(`Proposal accepted: ${p.name}`, [`<b>${esc(s.m.name || "The client lead")}</b> accepted the proposal for <b>${esc(p.name)}</b>.`], `/projects`).catch(() => null);
  refresh(p?.slug);
  return { ok: true, message: "Proposal accepted. Thank you." };
}

/** A comment from the client team on the project, a request or a meeting. */
export async function addComment(projectId: string, target: { type: "project" | "request" | "meeting" | "task" | "update"; id: string | null }, body: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  const text = body.trim();
  if (!ID.test(projectId) || (target.id && !ID.test(target.id)) || !["project", "request", "meeting", "task", "update"].includes(target.type)) return { ok: false, error: "Unknown item." };
  if (!text) return { ok: false, error: "Write a comment first." };
  const { error } = await s.supabase.from("project_comments").insert({ project_id: projectId, target_type: target.type, target_id: target.id, body: text.slice(0, 2000) });
  if (error) return { ok: false, error: "Couldn't post the comment." };
  const p = await projectOf(s.supabase, projectId);
  refresh(p?.slug);
  return { ok: true, message: "Comment posted" };
}

/** A 5-minute download link for the proposal, for people on the project. */
export async function proposalLink(projectId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  // Row level security: only people on the project can read it.
  const { data } = await s.supabase.from("projects").select("proposal_path, proposal_name").eq("id", projectId).maybeSingle();
  if (!data?.proposal_path) return { ok: false, error: "The proposal isn't uploaded yet." };
  const { data: signed } = await createServiceClient().storage.from("project-files").createSignedUrl(data.proposal_path, 300, { download: data.proposal_name || true });
  return signed?.signedUrl ? { ok: true, url: signed.signedUrl } : { ok: false, error: "Couldn't open the file. Please try again." };
}

/** A session booked in the project's Calendly becomes a project meeting. */
export async function recordProjectBooking(projectId: string, eventUri: string, inviteeUri: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(projectId) || !EVENT_URI.test(eventUri) || !INVITEE_URI.test(inviteeUri) || !inviteeUri.startsWith(eventUri + "/")) {
    return { ok: false, error: "We couldn't read that booking. It's still in Calendly." };
  }
  const b = await fetchBooking(eventUri, inviteeUri);
  const { error } = await s.supabase.rpc("record_project_booking", { p_project: projectId, p_invitee: inviteeUri, p_start: b?.start ?? null, p_join: b?.join ?? null });
  if (error) return { ok: true, message: "Booked in Calendly. You'll get the confirmation by email." };
  const p = await projectOf(s.supabase, projectId);
  if (p) await alertPartners(`Session booked: ${p.name}`, [`<b>${esc(s.m.name || "A client")}</b> booked a session for <b>${esc(p.name)}</b> in Calendly.`], `/projects`).catch(() => null);
  refresh(p?.slug);
  return { ok: true, message: "Booked. It's in your calendar and in Meetings." };
}

/** A note the client team shares with the partners (everyone on the project sees shared notes). */
export async function addSharedNote(projectId: string, body: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  const text = body.trim();
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  if (!text) return { ok: false, error: "Write a note first." };
  const { error } = await s.supabase.from("project_notes").insert({ project_id: projectId, body: text.slice(0, 4000), shared: true });
  if (error) return { ok: false, error: error.message.includes("note_limit") ? "You've added a lot of notes today. Try again tomorrow." : "Couldn't save the note." };
  const p = await projectOf(s.supabase, projectId);
  refresh(p?.slug);
  return { ok: true, message: "Note added" };
}

export async function deleteMyNote(id: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(id)) return { ok: false, error: "Unknown note." };
  const { data, error } = await s.supabase.from("project_notes").delete().eq("id", id).eq("author_id", s.m.id).select("project_id");
  if (error || !data?.length) return { ok: false, error: "Couldn't delete it." };
  refresh();
  return { ok: true, message: "Note deleted" };
}

/** The client lead adds a team member by email (members join straight away; others are invited to join). */
export async function inviteTeamMember(projectId: string, email: string, name: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  const clean = email.trim().toLowerCase();
  const { data, error } = await s.supabase.rpc("client_invite_person", { p_project: projectId, p_email: clean, p_name: name.trim() });
  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: m.includes("not_allowed") ? "Only client leads can add people." : m.includes("bad_email") ? "That email doesn't look right." : m.includes("invite_limit") ? "You've added 10 people today. Try again tomorrow." : m.includes("project_full") ? "This project has the most people it can take. Ask the partners." : m.includes("team_account") ? "That address belongs to the VentureWeavers team." : "Couldn't add them.",
    };
  }
  if (data === "already") return { ok: true, message: "They're already on this project." };
  const p = await projectOf(s.supabase, projectId);
  if (p && process.env.RESEND_API_KEY) {
    const joined = data === "added";
    await sendEmail(
      clean,
      `You're invited to ${p.name}`,
      emailFrame(
        `Join ${p.name}`,
        [`<b>${esc(s.m.name || "Your team")}</b> added you to <b>${esc(p.name)}</b>, a project with the VentureWeavers partners.`, "The project space has the plan and tasks, requests, meetings, notes and the project folder in one place.", joined ? "Open it in the member app." : "Join VentureWeavers with this email address to open it."],
        joined ? { label: "Open the project", href: `${APP}/projects/${p.slug}` } : { label: "Join VentureWeavers", href: `${APP}/join?next=${encodeURIComponent(`/projects/${p.slug}`)}` },
      ),
    ).catch(() => null);
    await alertPartners(`New person on ${p.name}`, [`<b>${esc(s.m.name || "The client lead")}</b> added <b>${esc(name.trim() || clean)}</b> (${esc(clean)}) to ${esc(p.name)} as a team member.`], `/projects/${projectId}`).catch(() => null);
  }
  refresh(p?.slug);
  return { ok: true, message: data === "added" ? "Added. They can open the project now." : "Invited. They join the project when they sign up with that email." };
}

export async function removeTeamMember(rowId: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(rowId)) return { ok: false, error: "Unknown person." };
  const { error } = await s.supabase.rpc("client_remove_person", { p_member_row: rowId });
  if (error) return { ok: false, error: "Only client leads can remove team members." };
  refresh();
  return { ok: true, message: "Removed from the project" };
}

/** Client people update the status of the client-side tasks. */
export async function setMyTaskStatus(taskId: string, status: string): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Sign in again." };
  if (!ID.test(taskId) || !TASK_STATUSES.some((x) => x.value === status)) return { ok: false, error: "Unknown task." };
  const { error } = await s.supabase.rpc("client_set_task_status", { p_task: taskId, p_status: status });
  if (error) return { ok: false, error: "You can update your team's tasks only." };
  refresh();
  return { ok: true, message: `Marked ${TASK_STATUSES.find((x) => x.value === status)!.label.toLowerCase()}` };
}
