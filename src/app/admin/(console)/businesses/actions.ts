"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { parseTags } from "@/lib/content/format";
import { ACTIVITY_KINDS, CURRENCIES, DEAL_STAGES, DEAL_TYPES, money, parseValue } from "@/lib/crm/format";
import { listCompanies } from "@/lib/crm/queries";
import { toCsv } from "@/lib/csv";
import { cleanCompanyLinkedIn, cleanWebsite, BUSINESS_TYPES, BUSINESS_STAGES } from "@/lib/profile/about";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function refresh() {
  revalidatePath("/admin/businesses", "layout");
  revalidatePath("/admin/contacts", "layout");
  revalidatePath("/admin", "layout");
}
const field = (form: FormData) => (k: string) => String(form.get(k) ?? "").trim();

// ---------------------------------------------------------------- businesses

function companyRow(form: FormData): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const s = field(form);
  const name = s("name").replace(/\s+/g, " ").slice(0, 120);
  if (!name) return { ok: false, error: "Add the business name." };
  const type = (BUSINESS_TYPES as readonly string[]).includes(s("type")) ? s("type") : null;
  const stage = type === "Venture" && (BUSINESS_STAGES as string[]).includes(s("stage")) ? s("stage") : null;
  const website = s("website") ? cleanWebsite(s("website")) : null;
  if (s("website") && !website) return { ok: false, error: "That website doesn't look right. Try something like company.com." };
  const linkedin = s("linkedin") ? cleanCompanyLinkedIn(s("linkedin")) : null;
  if (s("linkedin") && !linkedin) return { ok: false, error: "That LinkedIn page doesn't look right. It should look like linkedin.com/company/name." };
  const owner = ID.test(s("owner")) ? s("owner") : null;
  return {
    ok: true,
    row: {
      name,
      type,
      stage,
      website,
      linkedin,
      country: s("country").slice(0, 80) || null,
      tags: parseTags(s("tags")),
      notes: s("notes").slice(0, 4000),
      owner,
      status: s("status") === "archived" ? "archived" : "active",
    },
  };
}

export async function saveCompany(form: FormData): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  const id = field(form)("id") || null;
  if (id && !ID.test(id)) return { ok: false, error: "Unknown business." };
  const parsed = companyRow(form);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That business no longer exists." };
    const { error } = await supabase.from("companies").update(parsed.row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save the business." };
    await audit(admin.userId, "company.update", "companies", { entityId: id, before, after: parsed.row });
    refresh();
    return { ok: true, message: "Business saved", id };
  }
  const { data, error } = await supabase.from("companies").insert({ ...parsed.row, created_by: admin.userId }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't add the business." };
  await audit(admin.userId, "company.create", "companies", { entityId: data.id, after: parsed.row });
  refresh();
  return { ok: true, message: "Business added", id: data.id };
}

export async function duplicateCompany(id: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown business." };
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("name, type, stage, website, linkedin, country, tags, notes, owner").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That business no longer exists." };
  const { data: copy, error } = await supabase.from("companies").insert({ ...data, name: `${data.name} (copy)`.slice(0, 120), created_by: admin.userId }).select("id").single();
  if (error || !copy) return { ok: false, error: "Couldn't duplicate the business." };
  await audit(admin.userId, "company.create", "companies", { entityId: copy.id, after: { copied_from: id } });
  refresh();
  return { ok: true, message: "Duplicated (people and deals stay with the original)" };
}

export async function deleteCompany(id: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown business." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the business." };
  await audit(admin.userId, "company.delete", "companies", { entityId: id, before });
  refresh();
  return { ok: true, message: "Business deleted, with its deals and activity" };
}

export async function setCompanyStatus(id: string, status: "active" | "archived"): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown business." };
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't change the status." };
  await audit(admin.userId, "company.status", "companies", { entityId: id, after: { status } });
  refresh();
  return { ok: true, message: status === "archived" ? "Archived" : "Active again" };
}

export async function exportCompaniesCsv(): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const admin = await requireAdmin("businesses.view");
  const rows = await listCompanies();
  await audit(admin.userId, "export", "companies", { after: { rows: rows.length } });
  const open = (r: (typeof rows)[number]) => r.deals.filter((d) => ["Lead", "Qualified", "Proposal", "Negotiation"].includes(d.stage));
  return {
    ok: true,
    csv: toCsv(
      ["Business", "Type", "Stage", "Website", "LinkedIn", "Country", "Tags", "People", "Open deals", "Open value", "Owner", "Status", "Added"],
      rows.map((r) => [
        r.name, r.type, r.stage, r.website, r.linkedin, r.country, r.tags.join(", "), String(r.people), String(open(r).length),
        open(r).map((d) => money(d.value, d.currency)).join(" + "), r.ownerName, r.status === "archived" ? "Archived" : "Active", r.created_at.slice(0, 10),
      ]),
    ),
  };
}

// ---------------------------------------------------------------- people at a business

/** `who` is "m:<member id>" or "c:<contact id>". */
export async function linkPerson(companyId: string, who: string, role: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(companyId)) return { ok: false, error: "Unknown business." };
  const [kind, pid] = who.split(":");
  if (!ID.test(pid ?? "") || (kind !== "m" && kind !== "c")) return { ok: false, error: "Choose someone from the list." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_people").insert({ company_id: companyId, [kind === "m" ? "member_id" : "contact_id"]: pid, role: role.trim().slice(0, 80) || null });
  if (error) return { ok: false, error: error.code === "23505" ? "They're already linked to this business." : "Couldn't link them." };
  await audit(admin.userId, "company.link", "companies", { entityId: companyId, after: { who, role } });
  refresh();
  return { ok: true, message: "Linked" };
}

export async function updatePersonRole(linkId: string, role: string): Promise<Result> {
  await requireAdmin("businesses.manage");
  if (!ID.test(linkId)) return { ok: false, error: "Unknown person." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_people").update({ role: role.trim().slice(0, 80) || null }).eq("id", linkId);
  if (error) return { ok: false, error: "Couldn't save the role." };
  refresh();
  return { ok: true, message: "Role saved" };
}

export async function unlinkPerson(linkId: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(linkId)) return { ok: false, error: "Unknown person." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("company_people").select("*").eq("id", linkId).maybeSingle();
  const { error } = await supabase.from("company_people").delete().eq("id", linkId);
  if (error) return { ok: false, error: "Couldn't remove them." };
  await audit(admin.userId, "company.unlink", "companies", { entityId: (before as { company_id?: string } | null)?.company_id ?? linkId, before });
  refresh();
  return { ok: true, message: "Removed from the business" };
}

// ---------------------------------------------------------------- deals

export async function saveDeal(form: FormData): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  const s = field(form);
  const id = s("id") || null;
  const company_id = s("company_id");
  if ((id && !ID.test(id)) || !ID.test(company_id)) return { ok: false, error: "Unknown deal or business." };
  const title = s("title").replace(/\s+/g, " ").slice(0, 160);
  if (title.length < 2) return { ok: false, error: "Add a title for the deal." };
  const value = parseValue(s("value"));
  if (value === "invalid") return { ok: false, error: "Write the value as a number, like 18000." };
  const close = s("expected_close");
  if (close && !/^\d{4}-\d{2}-\d{2}$/.test(close)) return { ok: false, error: "Choose the expected close date." };
  const row = {
    company_id,
    title,
    type: (DEAL_TYPES as readonly string[]).includes(s("type")) ? s("type") : "Revenue-based",
    stage: (DEAL_STAGES as readonly string[]).includes(s("stage")) ? s("stage") : "Lead",
    value,
    currency: (CURRENCIES as readonly string[]).includes(s("currency")) ? s("currency") : "EGP",
    expected_close: close || null,
    owner: ID.test(s("owner")) ? s("owner") : null,
    service_id: ID.test(s("service_id")) ? s("service_id") : null,
    program_id: ID.test(s("program_id")) ? s("program_id") : null,
    notes: s("notes").slice(0, 4000),
  };
  const supabase = await createClient();
  if (id) {
    const { data: before } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That deal no longer exists." };
    const { error } = await supabase.from("deals").update(row).eq("id", id);
    if (error) return { ok: false, error: "Couldn't save the deal." };
    await audit(admin.userId, "deal.update", "deals", { entityId: id, before, after: row });
  } else {
    const { data, error } = await supabase.from("deals").insert({ ...row, created_by: admin.userId }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't add the deal." };
    await audit(admin.userId, "deal.create", "deals", { entityId: data.id, after: row });
  }
  refresh();
  return { ok: true, message: id ? "Deal saved" : "Deal added" };
}

export async function duplicateDeal(id: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown deal." };
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("company_id, title, type, value, currency, expected_close, owner, service_id, program_id, notes").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That deal no longer exists." };
  const { error } = await supabase.from("deals").insert({ ...data, title: `${data.title} (copy)`.slice(0, 160), stage: "Lead", created_by: admin.userId });
  if (error) return { ok: false, error: "Couldn't duplicate the deal." };
  await audit(admin.userId, "deal.create", "deals", { after: { copied_from: id } });
  refresh();
  return { ok: true, message: "Duplicated as a new lead" };
}

export async function setDealStage(id: string, stage: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(id) || !(DEAL_STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown deal or stage." };
  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't move the deal." };
  await audit(admin.userId, "deal.stage", "deals", { entityId: id, after: { stage } });
  refresh();
  return { ok: true, message: `Moved to ${stage}` };
}

export async function deleteDeal(id: string): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown deal." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the deal." };
  await audit(admin.userId, "deal.delete", "deals", { entityId: id, before });
  refresh();
  return { ok: true, message: "Deal deleted" };
}

// ---------------------------------------------------------------- activity and tasks

export async function logActivity(form: FormData): Promise<Result> {
  await requireAdmin("businesses.manage");
  const s = field(form);
  const company_id = s("company_id");
  if (!ID.test(company_id)) return { ok: false, error: "Unknown business." };
  const kind = ACTIVITY_KINDS.some((k) => k.value === s("kind")) ? s("kind") : "note";
  const body = s("body").slice(0, 4000);
  if (!body) return { ok: false, error: kind === "task" ? "Describe the task." : "Write what happened." };
  const due = s("due_at");
  if (kind === "task" && due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: "Choose a due date." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_activities").insert({
    company_id,
    kind,
    body,
    deal_id: ID.test(s("deal_id")) ? s("deal_id") : null,
    due_at: kind === "task" && due ? `${due}T16:00:00+02:00` : null,
  });
  if (error) return { ok: false, error: "Couldn't save it." };
  refresh();
  return { ok: true, message: kind === "task" ? "Task added" : "Logged" };
}

export async function setTaskDone(id: string, done: boolean): Promise<Result> {
  await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown task." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_activities").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("kind", "task");
  if (error) return { ok: false, error: "Couldn't update the task." };
  refresh();
  return { ok: true, message: done ? "Done" : "Reopened" };
}

export async function deleteActivity(id: string): Promise<Result> {
  await requireAdmin("businesses.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown entry." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_activities").delete().eq("id", id).neq("kind", "stage");
  if (error) return { ok: false, error: "Couldn't delete it." };
  refresh();
  return { ok: true, message: "Deleted" };
}

// ---------------------------------------------------------------- businesses members listed

/** Create a CRM business from a member's listed business and link the member to it. */
export async function createFromMemberBusiness(memberId: string, b: { name: string; type: string | null; stage: string | null; website: string | null; linkedin: string | null; role: string | null }): Promise<Result> {
  const admin = await requireAdmin("businesses.manage");
  if (!ID.test(memberId)) return { ok: false, error: "Unknown member." };
  const form = new FormData();
  for (const [k, v] of Object.entries({ name: b.name, type: b.type ?? "", stage: b.stage ?? "", website: b.website ?? "", linkedin: b.linkedin ?? "", owner: admin.userId })) form.set(k, v);
  const created = await saveCompany(form);
  if (!created.ok || !created.id) return created;
  const linked = await linkPerson(created.id, `m:${memberId}`, b.role ?? "");
  if (!linked.ok) return linked;
  return { ok: true, message: `${b.name} added and linked`, id: created.id };
}
