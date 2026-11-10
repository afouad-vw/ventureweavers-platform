"use server";

import { revalidatePath } from "next/cache";
import { BANNER_OPTIONS } from "@/components/ui/banner";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { parseTags } from "@/lib/content/format";
import { sendEnrolmentConfirmed, sendSeatOffered } from "@/lib/email/tvs";
import { parseList, parseOutline, parsePeople, peopleLinkError } from "@/lib/details";
import { slugify, toPiasters } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { APPLICATION_STATUSES, COHORT_STATUSES, PROGRAM_KINDS, PROGRAM_STATUSES, type ApplicationStatus } from "@/lib/tvs/format";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STORAGE = () => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/`;
const PROGRAM_COLS =
  "id, slug, name, kind, description, weeks, price_piasters, requires_tvac, tags, banner, banner_url, status, sort, short_description, details, audience, outline, prerequisites, activities, hosts, guests, brochure_url";
const MEET = /^https:\/\/[^\s<>"]{3,290}$/;

function refresh() {
  revalidatePath("/tvs", "layout");
  revalidatePath("/my-space");
  revalidatePath("/library");
  revalidatePath("/admin/tvs", "layout");
}

async function emailOf(memberId: string) {
  const { data } = await createServiceClient().auth.admin.getUserById(memberId);
  return data.user?.email ?? null;
}

async function uniqueSlug(base: string, exceptId?: string) {
  const supabase = await createClient();
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { data } = await supabase.from("programs").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------- programs

export async function saveProgram(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  if (id && !ID.test(id)) return { ok: false, error: "Unknown program." };
  const name = s("name");
  if (name.length < 2) return { ok: false, error: "Add a name." };
  const linkError = peopleLinkError(s("hosts"), "host") ?? peopleLinkError(s("guests"), "guest");
  if (linkError) return { ok: false, error: linkError };
  const short = s("short_description").replace(/\s+/g, " ");
  if (!short) return { ok: false, error: "Add a short description (shown on the card)." };
  if (short.length > 300) return { ok: false, error: "Keep the short description under 300 characters." };
  const banner_url = s("banner_url") || null;
  if (banner_url && !banner_url.startsWith(STORAGE() + "content-images/") && !banner_url.startsWith(STORAGE() + "event-banners/")) return { ok: false, error: "That banner image isn't from the upload folder." };
  const brochure_url = s("brochure_url") || null;
  if (brochure_url && !(brochure_url.startsWith(STORAGE() + "brochures/") && brochure_url.endsWith(".pdf"))) return { ok: false, error: "That brochure isn't from the upload folder." };
  const sort = Number(s("sort") || 100);
  const row = {
    name: name.slice(0, 80),
    kind: (PROGRAM_KINDS as readonly string[]).includes(s("kind")) ? s("kind") : "360 program",
    short_description: short,
    description: short,
    details: s("details").slice(0, 20000),
    audience: s("audience").replace(/\s+/g, " ").slice(0, 300),
    outline: parseOutline(s("outline")),
    prerequisites: parseList(s("prerequisites")),
    activities: parseList(s("activities")),
    hosts: parsePeople(s("hosts")),
    guests: parsePeople(s("guests")),
    brochure_url,
    weeks: (s("weeks") || "[N]").slice(0, 20),
    requires_tvac: form.get("requires_tvac") === "on",
    tags: parseTags(s("tags")),
    banner: (BANNER_OPTIONS as readonly string[]).includes(s("banner")) ? s("banner") : "Room",
    banner_url,
    status: PROGRAM_STATUSES.some((x) => x.value === s("status")) ? s("status") : "draft",
    sort: Number.isInteger(sort) ? Math.max(0, Math.min(1000, sort)) : 100,
  };
  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("programs").select(PROGRAM_COLS).eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That program no longer exists." };
    const { error } = await supabase.from("programs").update(row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save. Please try again." };
    await audit(admin.userId, "program.update", "programs", { entityId: id, before, after: row });
  } else {
    const { data, error } = await supabase.from("programs").insert({ ...row, slug: await uniqueSlug(slugify(name)), created_by: admin.userId }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't create the program." };
    await audit(admin.userId, "program.create", "programs", { entityId: data.id, after: row });
  }
  refresh();
  return { ok: true, message: id ? "Program saved" : "Program created. Add a cohort with dates and price in Cohorts." };
}

export async function duplicateProgram(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown program." };
  const supabase = await createClient();
  const { data } = await supabase.from("programs").select(PROGRAM_COLS).eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That program no longer exists." };
  const { id: _i, slug: _s, ...copy } = data as Record<string, unknown>;
  void _i;
  void _s;
  const name = `${String(copy.name)} (copy)`.slice(0, 80);
  const { data: made, error } = await supabase.from("programs").insert({ ...copy, name, status: "draft", slug: await uniqueSlug(slugify(name)), created_by: admin.userId }).select("id").single();
  if (error || !made) return { ok: false, error: "Couldn't duplicate it." };
  await audit(admin.userId, "program.duplicate", "programs", { entityId: made.id, after: { from: id } });
  refresh();
  return { ok: true, message: "Duplicated as a draft" };
}

export async function deleteProgram(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown program." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("programs").select(PROGRAM_COLS).eq("id", id).maybeSingle();
  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? "This program has applications or cohorts. Set it to Closed or Draft instead." : "Couldn't delete it." };
  await audit(admin.userId, "program.delete", "programs", { entityId: id, before });
  refresh();
  return { ok: true, message: "Program deleted" };
}

export async function setProgramStatus(id: string, status: string): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id) || !PROGRAM_STATUSES.some((x) => x.value === status)) return { ok: false, error: "Unknown status." };
  const supabase = await createClient();
  const { error } = await supabase.from("programs").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't change the status." };
  await audit(admin.userId, "program.status", "programs", { entityId: id, after: { status } });
  refresh();
  return { ok: true, message: `Status: ${PROGRAM_STATUSES.find((x) => x.value === status)?.label}` };
}

// ---------------------------------------------------------------- cohorts

export async function saveCohort(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  if (id && !ID.test(id)) return { ok: false, error: "Unknown cohort." };
  if (!ID.test(s("program_id"))) return { ok: false, error: "Choose a program." };
  const startsOn = s("starts_on");
  const endsOn = s("ends_on");
  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { ok: false, error: "Choose a start date." };
  if (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return { ok: false, error: "Choose an end date." };
  if (startsOn && endsOn && endsOn < startsOn) return { ok: false, error: "The end date is before the start date." };
  const cap = s("capacity") ? Number(s("capacity")) : null;
  if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 1000)) return { ok: false, error: "Capacity must be a whole number from 1." };
  let price_piasters: number | null;
  try {
    price_piasters = toPiasters(s("price"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const format = s("format") === "Online" || s("format") === "In person" ? s("format") : null;
  const meet = s("meet_url");
  if (meet && !MEET.test(meet)) return { ok: false, error: "The Meet link should start with https://" };
  const row = {
    program_id: s("program_id"),
    label: (s("label") || "Cohort [NO.]").slice(0, 60),
    starts_on: startsOn || null,
    ends_on: endsOn || null,
    format,
    location: format === "In person" ? s("location").slice(0, 160) || null : null,
    capacity: cap,
    price_piasters,
    status: COHORT_STATUSES.some((x) => x.value === s("status")) ? s("status") : "planned",
  };
  const supabase = await createClient();
  let cohortId = id;
  if (id) {
    const { data: before } = await supabase.from("cohorts").select("id, program_id, label, starts_on, ends_on, format, location, capacity, price_piasters, status").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That cohort no longer exists." };
    if (cap !== null) {
      const { count } = await supabase.from("enrolments").select("id", { count: "exact", head: true }).eq("cohort_id", id).in("status", ["offered", "confirmed"]);
      if ((count ?? 0) > cap) return { ok: false, error: `${count} seats are already offered or taken. Capacity can't be lower.` };
    }
    const { error } = await supabase.from("cohorts").update(row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save the cohort." };
    await audit(admin.userId, "cohort.update", "cohorts", { entityId: id, before, after: row });
  } else {
    const { data, error } = await supabase.from("cohorts").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't create the cohort." };
    cohortId = data.id as string;
    await audit(admin.userId, "cohort.create", "cohorts", { entityId: data.id, after: row });
  }
  // The Meet link (online only) is kept apart so only enrolled learners can read it. Empty = TBA.
  const { error: linkErr } = await supabase.from("cohort_links").upsert({ cohort_id: cohortId, meet_url: format === "Online" ? meet || null : null });
  if (linkErr) return { ok: false, error: "Saved, but the Meet link didn't save. Try again." };
  refresh();
  return { ok: true, message: id ? "Cohort saved" : "Cohort created" };
}

export async function deleteCohort(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown cohort." };
  const supabase = await createClient();
  const { error } = await supabase.from("cohorts").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? "This cohort has learners. Set it to Finished instead." : "Couldn't delete it." };
  await audit(admin.userId, "cohort.delete", "cohorts", { entityId: id });
  refresh();
  return { ok: true, message: "Cohort deleted" };
}

// ---------------------------------------------------------------- applications

export async function moveApplication(id: string, status: ApplicationStatus): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id) || !APPLICATION_STATUSES.some((x) => x.value === status)) return { ok: false, error: "Unknown stage." };
  if (status === "won") return { ok: false, error: "Offer a seat to move an application to Won." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("applications").select("status").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "That application no longer exists." };
  if (before.status === "won") return { ok: false, error: "This applicant has a seat. Cancel the enrolment in Learners first." };
  const { error } = await supabase.from("applications").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't move it." };
  await audit(admin.userId, "application.move", "applications", { entityId: id, before, after: { status } });
  refresh();
  return { ok: true, message: `Moved to ${APPLICATION_STATUSES.find((x) => x.value === status)?.label}` };
}

export async function setApplicationOwner(id: string, owner: string): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown application." };
  const clean = owner.trim().slice(0, 60) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ owner: clean }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't set the owner." };
  await audit(admin.userId, "application.owner", "applications", { entityId: id, after: { owner: clean } });
  refresh();
  return { ok: true, message: clean ? `Owner: ${clean}` : "Owner cleared" };
}

export async function deleteApplication(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("tvs.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown application." };
  const supabase = await createClient();
  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, "application.delete", "applications", { entityId: id });
  refresh();
  return { ok: true, message: "Application deleted" };
}

/** Offer a seat in a cohort (moves the application to Won). Zero means a sponsored seat, confirmed at once. */
export async function offerSeat(applicationId: string, cohortId: string, amountEGP: string): Promise<ActionResult> {
  await requireAdmin("tvs.manage");
  if (!ID.test(applicationId) || !ID.test(cohortId)) return { ok: false, error: "Choose a cohort." };
  let amount: number | null;
  try {
    amount = toPiasters(amountEGP);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (amount === null) return { ok: false, error: "Set the amount (0 for a sponsored seat)." };
  const supabase = await createClient();
  const { data: enId, error } = await supabase.rpc("admin_offer_seat", { p_application: applicationId, p_cohort: cohortId, p_amount: amount });
  if (error || !enId) {
    const m = error?.message ?? "";
    const known: Record<string, string> = {
      cohort_full: "That cohort is full.",
      cohort_closed: "That cohort has finished.",
      wrong_program: "That cohort belongs to a different program.",
      already_enrolled: "This applicant already has a seat in that cohort.",
      declined: "Reopen the application before offering a seat.",
    };
    return { ok: false, error: Object.entries(known).find(([k]) => m.includes(k))?.[1] ?? "Couldn't offer the seat." };
  }
  const { data: en } = await supabase.from("enrolments").select("member_id, amount_piasters, pay_reference, cohorts(label, programs(name))").eq("id", enId as string).maybeSingle();
  const row = en as unknown as { member_id: string; amount_piasters: number; pay_reference: string; cohorts: { label: string; programs: { name: string } | null } | null } | null;
  if (row) {
    const to = await emailOf(row.member_id);
    if (to) await sendSeatOffered(to, { program: row.cohorts?.programs?.name ?? "the program", cohort: row.cohorts?.label ?? "the cohort", amount_piasters: row.amount_piasters, pay_reference: row.pay_reference }).catch(() => null);
  }
  refresh();
  return { ok: true, message: amount === 0 ? "Sponsored seat confirmed" : "Seat offered; waiting for payment" };
}

// ---------------------------------------------------------------- enrolments

export async function confirmEnrolment(id: string): Promise<ActionResult> {
  await requireAdmin(["tvs.manage", "payments.manage"]);
  if (!ID.test(id)) return { ok: false, error: "Unknown enrolment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_confirm_enrolment", { p_enrolment: id });
  if (error) return { ok: false, error: error.message.includes("not_payable") ? "Only seats waiting for payment can be marked paid." : "Couldn't mark it paid." };
  const { data: en } = await supabase.from("enrolments").select("member_id, cohorts(label, programs(name))").eq("id", id).maybeSingle();
  const row = en as unknown as { member_id: string; cohorts: { label: string; programs: { name: string } | null } | null } | null;
  if (row) {
    const to = await emailOf(row.member_id);
    if (to) await sendEnrolmentConfirmed(to, { program: row.cohorts?.programs?.name ?? "the program", cohort: row.cohorts?.label ?? "the cohort" }).catch(() => null);
  }
  refresh();
  return { ok: true, message: "Marked paid; the learner is enrolled" };
}

export async function cancelEnrolment(id: string): Promise<ActionResult> {
  await requireAdmin(["tvs.manage", "payments.manage"]);
  if (!ID.test(id)) return { ok: false, error: "Unknown enrolment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_enrolment", { p_enrolment: id });
  if (error) return { ok: false, error: "Couldn't cancel it." };
  refresh();
  return { ok: true, message: "Enrolment cancelled; the seat is free" };
}
