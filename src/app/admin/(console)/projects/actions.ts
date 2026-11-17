"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { cleanCalendlyUrl } from "@/lib/calendly-url";
import { allAuthUsers } from "@/lib/contacts/queries";
import { emailFrame, esc, sendEmail } from "@/lib/email/send";
import { cairoLocalToISO, slugify } from "@/lib/events/format";
import {
  cleanDriveUrl,
  DEFAULT_DIMENSIONS,
  lines,
  MEETING_KINDS,
  parseAmount,
  PROJECT_STATUSES,
  REQUEST_STATUSES,
  staffRequestMoves,
  type RequestStatus,
} from "@/lib/projects/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
const PROPOSAL = /^proposals\/\d{4}-\d{2}\/[0-9a-f-]{36}\.pdf$/;

const manage = () => requireAdmin("projects.manage");
function refresh(id?: string) {
  revalidatePath("/admin/projects", "layout");
  revalidatePath("/projects", "layout");
  if (id) revalidatePath(`/admin/projects/${id}`);
}

async function uniqueSlug(base: string, exceptId?: string) {
  const supabase = await createClient();
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { data } = await supabase.from("projects").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Create or edit a project's settings, terms, proposal, Drive folder and Calendly link. */
export async function saveProject(form: FormData): Promise<ActionResult> {
  const admin = await manage();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  if (id && !ID.test(id)) return { ok: false, error: "Unknown project." };
  const name = s("name").replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Add the project's name." };
  const kind = s("kind") === "portfolio" ? "portfolio" : "venture";
  const parent_id = kind === "venture" && ID.test(s("parent_id")) ? s("parent_id") : null;
  const company_id = ID.test(s("company_id")) ? s("company_id") : null;
  const retainer = parseAmount(s("retainer_amount"));
  if (Number.isNaN(retainer)) return { ok: false, error: "Write the retainer as a number, for example 3000." };
  const term = s("term_months") ? Number(s("term_months")) : null;
  if (term !== null && !(Number.isInteger(term) && term >= 1 && term <= 60)) return { ok: false, error: "The term is 1 to 60 months." };
  const starts = s("starts_on");
  if (starts && !/^\d{4}-\d{2}-\d{2}$/.test(starts)) return { ok: false, error: "Pick a start date." };
  const driveRaw = s("drive_url");
  const drive_url = cleanDriveUrl(driveRaw);
  if (driveRaw && !drive_url) return { ok: false, error: "That isn't a Google Drive folder link. Open the folder in Drive and copy the address." };
  const calRaw = s("calendly_url");
  const calendly_url = cleanCalendlyUrl(calRaw);
  if (calRaw && !calendly_url) return { ok: false, error: "That isn't a Calendly scheduling link." };
  const proposal_path = s("proposal_path") || null;
  if (proposal_path && !PROPOSAL.test(proposal_path)) return { ok: false, error: "That proposal file isn't from the upload folder." };
  const dimensions = lines(form.get("dimensions"), 10, 80);
  const row = {
    name: name.slice(0, 120),
    kind,
    parent_id,
    company_id,
    service: s("service") === "mentorship" ? "mentorship" : "fractional_leadership",
    status: PROJECT_STATUSES.some((x) => x.value === s("status")) ? s("status") : "setup",
    health: ["green", "amber", "red"].includes(s("health")) ? s("health") : "green",
    summary: s("summary").slice(0, 800),
    goals: lines(form.get("goals"), 12, 300),
    dimensions: dimensions.length ? dimensions : DEFAULT_DIMENSIONS,
    starts_on: starts || null,
    term_months: term,
    retainer_amount: retainer,
    currency: s("currency") === "EGP" ? "EGP" : "USD",
    billing: s("billing") === "start_of_month" ? "start_of_month" : "end_of_month",
    cadence: s("cadence").slice(0, 300),
    key_terms: s("key_terms").slice(0, 6000),
    proposal_path,
    proposal_name: proposal_path ? (s("proposal_name") || "Proposal.pdf").slice(0, 160) : null,
    drive_url: drive_url || null,
    calendly_url: calendly_url || null,
  };
  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That project no longer exists." };
    // A new proposal file needs accepting again.
    const reset = before.proposal_path !== row.proposal_path ? { proposal_accepted_at: null, proposal_accepted_by: null } : {};
    const { error } = await supabase.from("projects").update({ ...row, ...reset }).eq("id", id);
    if (error) return { ok: false, error: error.message.includes("parent_not_portfolio") ? "A venture can only sit under a portfolio project." : error.message.includes("portfolio_has_ventures") ? "This portfolio has venture projects. Move them first." : "Couldn't save the project." };
    await audit(admin.userId, "project.update", "projects", { entityId: id, before, after: row });
    refresh(id);
    return { ok: true, message: "Project saved", id };
  }
  const slug = await uniqueSlug(slugify(name));
  const { data, error } = await supabase.from("projects").insert({ ...row, slug, created_by: admin.userId }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't create the project." };
  await audit(admin.userId, "project.create", "projects", { entityId: data.id, after: row });
  refresh();
  return { ok: true, message: "Project created", id: data.id };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown project." };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? "This portfolio has venture projects. Delete or move them first." : "Couldn't delete it." };
  await audit(admin.userId, "project.delete", "projects", { entityId: id });
  refresh();
  return { ok: true, message: "Project deleted" };
}

/** Adds a client person (a member, or an email until they join) and tells them. */
export async function addProjectPerson(projectId: string, person: { member_id?: string; email?: string; name?: string }, role: "lead" | "team"): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  const supabase = await createClient();
  const email = person.email?.trim().toLowerCase();
  let memberId = person.member_id && ID.test(person.member_id) ? person.member_id : null;
  if (!memberId && email) {
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) return { ok: false, error: "That email doesn't look right." };
    memberId = (await allAuthUsers()).find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }
  if (!memberId && !email) return { ok: false, error: "Pick someone or type their email." };
  const { data: adminRow } = memberId ? await supabase.from("admin_users").select("user_id").eq("user_id", memberId).maybeSingle() : { data: null };
  if (adminRow) return { ok: false, error: "That's a team account. Add client people only." };
  const row: Record<string, unknown> = { project_id: projectId, role, name: person.name?.slice(0, 120) ?? null, added_by: admin.userId, ...(memberId ? { member_id: memberId } : { email }) };
  const { error } = await supabase.from("project_members").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "They're already on this project." : "Couldn't add them." };
  await audit(admin.userId, "project.person_add", "project_members", { entityId: projectId, after: { member: memberId, email, role } });
  // Tell them by email (members also get a bell notification from the database).
  const { data: p } = await supabase.from("projects").select("name, slug").eq("id", projectId).maybeSingle();
  if (p) {
    const svc = createServiceClient();
    const to = email ?? (memberId ? (await svc.auth.admin.getUserById(memberId)).data.user?.email : null);
    if (to && process.env.RESEND_API_KEY) {
      await sendEmail(
        to,
        `Your project space: ${p.name}`,
        emailFrame(
          `Welcome to ${p.name}`,
          [
            `The VentureWeavers partners added you to <b>${esc(p.name)}</b> as ${role === "lead" ? "the client lead" : "a team member"}.`,
            "Your project space has the proposal and scope, requests, meetings and the project folder in one place.",
            memberId ? "Open it in the member app." : "Join VentureWeavers with this email address to open it.",
          ],
          memberId ? { label: "Open the project", href: `${APP}/projects/${p.slug}` } : { label: "Join VentureWeavers", href: `${APP}/join?next=${encodeURIComponent(`/projects/${p.slug}`)}` },
        ),
      ).catch(() => null);
    }
  }
  refresh(projectId);
  return { ok: true, message: "Added to the project" };
}

export async function setProjectPersonRole(id: string, role: "lead" | "team"): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown person." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").update({ role: role === "lead" ? "lead" : "team" }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't change their role." };
  await audit(admin.userId, "project.person_role", "project_members", { entityId: id, after: { role } });
  refresh();
  return { ok: true, message: role === "lead" ? "Now a client lead" : "Now a team member" };
}

export async function removeProjectPerson(id: string): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown person." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove them." };
  await audit(admin.userId, "project.person_remove", "project_members", { entityId: id });
  refresh();
  return { ok: true, message: "Removed from the project" };
}

/** Scope: one line of what's included (dimension, title, details, outputs). */
export async function saveScopeItem(form: FormData): Promise<ActionResult> {
  const admin = await manage();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  const projectId = s("project_id");
  if (!ID.test(projectId) || (id && !ID.test(id))) return { ok: false, error: "Unknown project." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  const sort = Number(s("sort") || 100);
  const row = { dimension: s("dimension").slice(0, 80), title: s("title").slice(0, 160), details: s("details").slice(0, 1500), outputs: lines(form.get("outputs"), 12, 120), sort: Number.isInteger(sort) ? Math.max(0, Math.min(1000, sort)) : 100 };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("project_scope_items").update(row).eq("id", id) : await supabase.from("project_scope_items").insert({ ...row, project_id: projectId });
  if (error) return { ok: false, error: "Couldn't save the scope item." };
  await audit(admin.userId, id ? "project.scope_update" : "project.scope_add", "project_scope_items", { entityId: id ?? projectId, after: row });
  refresh(projectId);
  return { ok: true, message: "Scope saved" };
}

export async function deleteScopeItem(id: string): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_scope_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove it." };
  await audit(admin.userId, "project.scope_delete", "project_scope_items", { entityId: id });
  refresh();
  return { ok: true, message: "Removed from the scope" };
}

/** A request the client made verbally (on a call or in a session), logged by the team. */
export async function addTeamRequest(form: FormData): Promise<ActionResult> {
  const admin = await manage();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  if (!ID.test(s("project_id"))) return { ok: false, error: "Unknown project." };
  if (s("title").length < 3) return { ok: false, error: "Add a short title." };
  const supabase = await createClient();
  const row = { project_id: s("project_id"), title: s("title").slice(0, 160), details: s("details").slice(0, 4000), source: "team", received_note: s("received_note").slice(0, 300) };
  const { data, error } = await supabase.from("project_requests").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't add the request." };
  await audit(admin.userId, "project.request_add", "project_requests", { entityId: data.id, after: row });
  refresh(row.project_id);
  return { ok: true, message: "Request added", id: data.id };
}

/**
 * Respond to a request: quote it (price, details, requirements, timeline), decline it with a reason,
 * or move it on (in review, in progress, done). Approval is the client lead's.
 */
export async function respondToRequest(form: FormData): Promise<ActionResult> {
  const admin = await manage();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id");
  const next = s("status") as RequestStatus;
  if (!ID.test(id) || !REQUEST_STATUSES.some((x) => x.value === next)) return { ok: false, error: "Unknown request." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("project_requests").select("id, project_id, status, price, title").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "That request no longer exists." };
  const moves = staffRequestMoves({ status: before.status, price: before.price === null ? null : Number(before.price) });
  if (next !== before.status && !moves.includes(next)) return { ok: false, error: "That step isn't available for this request." };
  const update: Record<string, unknown> = { status: next };
  if (next === "quoted") {
    const price = parseAmount(s("price"));
    if (price === null || Number.isNaN(price)) return { ok: false, error: "Add the price (0 if it's included)." };
    update.price = price;
    update.currency = s("currency") === "EGP" ? "EGP" : "USD";
    update.response = s("response").slice(0, 4000);
    update.requirements = s("requirements").slice(0, 2000);
    update.timeline = s("timeline").slice(0, 200);
    if (!update.response) return { ok: false, error: "Add the details of what you'll do." };
  }
  if (next === "declined") {
    update.decline_reason = s("decline_reason").slice(0, 1000);
    if (!update.decline_reason) return { ok: false, error: "Add a short reason for the client." };
  }
  const { error } = await supabase.from("project_requests").update(update).eq("id", id);
  if (error) {
    const m = error.message;
    return { ok: false, error: m.includes("needs_approval") ? "The client lead needs to approve the quote first." : m.includes("price_locked") ? "The client approved this price; it can't change." : m.includes("client_decides") ? "Only the client lead can approve." : "Couldn't update the request." };
  }
  await audit(admin.userId, "project.request_respond", "project_requests", { entityId: id, before, after: update });
  refresh(before.project_id);
  return { ok: true, message: next === "quoted" ? "Quote sent to the client lead" : `Moved to ${REQUEST_STATUSES.find((x) => x.value === next)?.label}` };
}

export async function deleteRequest(id: string): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown request." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_requests").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, "project.request_delete", "project_requests", { entityId: id });
  refresh();
  return { ok: true, message: "Request deleted" };
}

/** Schedule or edit a meeting (Cairo time). Members are told in their bell. */
export async function saveMeeting(form: FormData): Promise<ActionResult> {
  const admin = await manage();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  const projectId = s("project_id");
  if (!ID.test(projectId) || (id && !ID.test(id))) return { ok: false, error: "Unknown project." };
  if (s("title").length < 2) return { ok: false, error: "Add a title." };
  if (!s("starts_at")) return { ok: false, error: "Pick the date and time." };
  let startsAt: string;
  try {
    startsAt = cairoLocalToISO(s("starts_at"));
  } catch {
    return { ok: false, error: "Pick the date and time." };
  }
  const minutes = Number(s("minutes") || 60);
  const meet = s("meet_url");
  if (meet && !/^https:\/\/[^\s<>"]+$/.test(meet)) return { ok: false, error: "The meeting link should start with https://" };
  const row = {
    title: s("title").slice(0, 160),
    kind: MEETING_KINDS.some((k) => k.value === s("kind")) ? s("kind") : "weekly",
    starts_at: startsAt,
    minutes: Number.isInteger(minutes) ? Math.max(15, Math.min(480, minutes)) : 60,
    meet_url: meet || null,
    agenda: s("agenda").slice(0, 3000),
    notes: s("notes").slice(0, 8000),
    status: ["scheduled", "done", "cancelled"].includes(s("status")) ? s("status") : "scheduled",
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("project_meetings").update(row).eq("id", id) : await supabase.from("project_meetings").insert({ ...row, project_id: projectId, created_by: admin.userId });
  if (error) return { ok: false, error: "Couldn't save the meeting." };
  await audit(admin.userId, id ? "project.meeting_update" : "project.meeting_add", "project_meetings", { entityId: id ?? projectId, after: row });
  refresh(projectId);
  return { ok: true, message: id ? "Meeting saved" : "Meeting scheduled. The client team is told in their bell." };
}

export async function deleteMeeting(id: string): Promise<ActionResult> {
  const admin = await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown meeting." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_meetings").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, "project.meeting_delete", "project_meetings", { entityId: id });
  refresh();
  return { ok: true, message: "Meeting deleted" };
}

export async function addNote(projectId: string, body: string): Promise<ActionResult> {
  await manage();
  const text = body.trim();
  if (!ID.test(projectId) || !text) return { ok: false, error: "Write a note first." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_notes").insert({ project_id: projectId, body: text.slice(0, 4000) });
  if (error) return { ok: false, error: "Couldn't save the note." };
  refresh(projectId);
  return { ok: true, message: "Note saved" };
}

export async function setNotePinned(id: string, pinned: boolean): Promise<ActionResult> {
  await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown note." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_notes").update({ pinned }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the note." };
  refresh();
  return { ok: true, message: pinned ? "Pinned" : "Unpinned" };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown note." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_notes").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  refresh();
  return { ok: true, message: "Note deleted" };
}

/** A partner's comment on the project, a request or a meeting; internal ones stay with the team. */
export async function addStaffComment(projectId: string, target: { type: "project" | "request" | "meeting"; id: string | null }, body: string, internal: boolean): Promise<ActionResult> {
  await manage();
  const text = body.trim();
  if (!ID.test(projectId) || (target.id && !ID.test(target.id)) || !["project", "request", "meeting"].includes(target.type)) return { ok: false, error: "Unknown item." };
  if (!text) return { ok: false, error: "Write a comment first." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_comments").insert({ project_id: projectId, target_type: target.type, target_id: target.id, body: text.slice(0, 2000), internal });
  if (error) return { ok: false, error: "Couldn't post the comment." };
  refresh(projectId);
  return { ok: true, message: internal ? "Internal comment added" : "Comment added" };
}

export async function deleteComment(id: string): Promise<ActionResult> {
  await manage();
  if (!ID.test(id)) return { ok: false, error: "Unknown comment." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_comments").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  refresh();
  return { ok: true, message: "Comment deleted" };
}

/** A 5-minute download link for the proposal (staff). */
export async function adminProposalLink(projectId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin("projects.view");
  if (!ID.test(projectId)) return { ok: false, error: "Unknown project." };
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("proposal_path, proposal_name").eq("id", projectId).maybeSingle();
  if (!data?.proposal_path) return { ok: false, error: "No proposal uploaded yet." };
  const { data: signed } = await createServiceClient().storage.from("project-files").createSignedUrl(data.proposal_path, 300, { download: data.proposal_name || true });
  return signed?.signedUrl ? { ok: true, url: signed.signedUrl } : { ok: false, error: "Couldn't open the file." };
}
