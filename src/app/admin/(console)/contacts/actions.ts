"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { loadPeople, type Space } from "@/lib/contacts/queries";
import { parseCsv, toContacts } from "@/lib/contacts/import";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseAbout } from "@/lib/profile/about";
import { sendPartnerPasswordReset } from "@/lib/email/account";
import type { FormState } from "@/lib/auth/form-state";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SPACES: Space[] = ["Outloud", "TVS", "BRICKR", "QuidQuo"];
const CONSENT = ["Email, WhatsApp, push", "Email, WhatsApp", "Email", "WhatsApp", "Not asked yet"];
const cleanTags = (v: FormDataEntryValue[]) => SPACES.filter((s) => v.map(String).includes(s));

const refresh = () => {
  revalidatePath("/admin/contacts", "layout");
  revalidatePath("/admin", "page");
};

/** Add or edit a contact the partners added (members' own details are theirs to change). */
export async function saveContact(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("contacts.manage");
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || null;
  if (id && !ID.test(id)) return { ok: false, error: "Unknown contact." };
  if (!s("name")) return { ok: false, error: "Add a name." };
  const email = s("email").toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "That email doesn't look right." };
  const row = {
    name: s("name").slice(0, 120),
    email,
    phone: s("phone").replace(/[^\d+ ()-]/g, "").slice(0, 40) || null,
    company: s("company").slice(0, 120) || null,
    role: s("role").slice(0, 80) || null,
    tags: cleanTags(form.getAll("tags")),
    consent: CONSENT.includes(s("consent")) ? s("consent") : "Not asked yet",
  };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("contacts").update(row).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "Someone with that email is already in contacts." : "Couldn't save." };
    await audit(admin.userId, "contact.update", "contacts", { entityId: id, after: { ...row, email: row.email ? "set" : null, phone: row.phone ? "set" : null } });
  } else {
    const source = admin.displayName ? `Added by ${admin.displayName.split(" ")[0]}` : "Added by admin";
    const { data, error } = await supabase.from("contacts").insert({ ...row, source, created_by: admin.userId }).select("id").single();
    if (error || !data) return { ok: false, error: error?.code === "23505" ? "Someone with that email is already in contacts." : "Couldn't add the contact." };
    await audit(admin.userId, "contact.create", "contacts", { entityId: data.id });
  }
  refresh();
  return { ok: true, message: id ? "Contact saved" : "Contact added" };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("contacts.manage");
  if (!ID.test(id)) return { ok: false, error: "Unknown contact." };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };
  await audit(admin.userId, "contact.delete", "contacts", { entityId: id });
  refresh();
  return { ok: true, message: "Contact deleted" };
}

/** Private note and admin tags for a member or an added contact. */
export async function saveNote(target: { memberId?: string | null; contactId?: string | null }, note: string, tags: string[]): Promise<ActionResult> {
  const admin = await requireAdmin("contacts.manage");
  const memberId = target.memberId && ID.test(target.memberId) ? target.memberId : null;
  const contactId = !memberId && target.contactId && ID.test(target.contactId) ? target.contactId : null;
  if (!memberId && !contactId) return { ok: false, error: "Notes can be added to members and added contacts." };
  const row = { note: note.slice(0, 4000), tags: SPACES.filter((s) => tags.includes(s)), updated_by: admin.userId };
  const supabase = await createClient();
  const col = memberId ? "member_id" : "contact_id";
  const val = memberId ?? contactId!;
  const { data: existing } = await supabase.from("contact_notes").select("id").eq(col, val).maybeSingle();
  const { error } = existing
    ? await supabase.from("contact_notes").update(row).eq("id", existing.id)
    : await supabase.from("contact_notes").insert({ ...row, [col]: val });
  if (error) return { ok: false, error: "Couldn't save the note." };
  await audit(admin.userId, "contact.note", "contact_notes", { entityId: val });
  refresh();
  return { ok: true, message: "Saved" };
}

/** Import contacts from CSV text (read in the browser). Duplicates by email, members included, are skipped. */
export async function importContacts(text: string): Promise<{ ok: true; added: number; skipped: { line: number; reason: string }[] } | { ok: false; error: string }> {
  const admin = await requireAdmin("contacts.manage");
  if (text.length > 2_000_000) return { ok: false, error: "The file is too large (2 MB at most)." };
  const { contacts } = await loadPeople();
  const existing = new Set(contacts.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[]);
  const { rows, skipped } = toContacts(parseCsv(text), existing);
  if (!rows.length) return { ok: true, added: 0, skipped };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert(rows.map((r) => ({ ...r, source: "CSV import", consent: "Not asked yet", created_by: admin.userId })));
  if (error) return { ok: false, error: "Couldn't import. Check the file and try again." };
  await audit(admin.userId, "contact.import", "contacts", { after: { added: rows.length, skipped: skipped.length } });
  refresh();
  return { ok: true, added: rows.length, skipped };
}

export async function exportContactsCsv(space: string, q: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const admin = await requireAdmin("contacts.manage");
  const { contacts } = await loadPeople();
  const needle = q.trim().toLowerCase();
  const rows = contacts.filter(
    (c) => (space === "All" || c.spaces.includes(space as Space)) && (!needle || `${c.name} ${c.company ?? ""} ${c.role ?? ""} ${c.email ?? ""} ${c.spaces.join(" ")}`.toLowerCase().includes(needle)),
  );
  await audit(admin.userId, "export", "contacts", { after: { rows: rows.length, space } });
  return {
    ok: true,
    csv: toCsv(
      ["Name", "Email", "Mobile", "Business", "Business type", "Website", "Role", "Country", "Spaces", "Source", "Consent", "Last activity", "Joined"],
      rows.map((c) => [c.name, c.email, c.phone, c.company, c.businessType, c.businessWebsite, c.role, c.country, c.spaces.join(", "), c.source, c.consent, c.last?.text ?? "", formatDate(c.joinedAt)]),
    ),
  };
}

// ---------------------------------------------------------------- member accounts (Phase 13)

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;
const BAN_FOREVER = "876000h";

function dbError(message: string | undefined, fallback: string) {
  const m = message ?? "";
  if (m.includes("admin_account")) return "Admin accounts can't be changed from Contacts.";
  if (m.includes("not_admin")) return "Only partners can do that.";
  if (m.includes("bad_phone")) return "Add the mobile number with its country code.";
  if (m.includes("bad_interests")) return "Pick at least one interest.";
  if (m.includes("bad_contact")) return "Choose at least one way to communicate.";
  if (m.includes("linkedin")) return "That LinkedIn link doesn't look right.";
  if (m.includes("too_many_resets")) return "Three reset emails were sent in the last hour. Try again later.";
  if (m.includes("not_found")) return "We couldn't find that member.";
  return fallback;
}

/** Edit a member's details (the "About you" fields). Their email and newsletter choice stay theirs. */
export async function updateMember(memberId: string, _state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin("contacts.manage");
  if (!ID.test(memberId)) return { error: "Unknown member." };
  const parsed = parseAbout((k) => form.get(k), (k) => form.getAll(k));
  if (!parsed.ok) return { error: parsed.error.replace("your ", "the ").replace("Add the name.", "Add a name.") };
  const v = parsed.value;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_member", {
    p_member: memberId,
    p_full_name: v.full_name,
    p_phone: v.phone,
    p_linkedin: v.linkedin ?? "",
    p_country: v.country,
    p_role: v.role,
    p_goals: v.goals,
    p_contact_prefs: v.contact_prefs,
    p_business_name: v.business_name ?? "",
    p_business_website: v.business_website ?? "",
    p_business_type: v.business_type ?? "",
  });
  if (error) return { error: dbError(error.message, "Couldn't save the details.") };
  refresh();
  return { message: "Details saved. The member was told in their notifications." };
}

/** Email the member a 2-hour link to choose a new password. Nobody else sees or sets it. */
export async function sendPasswordReset(memberId: string): Promise<ActionResult> {
  await requireAdmin("contacts.manage");
  if (!ID.test(memberId)) return { ok: false, error: "Unknown member." };
  const svc = createServiceClient();
  const { data: u } = await svc.auth.admin.getUserById(memberId);
  const email = u?.user?.email;
  if (!email) return { ok: false, error: "This member has no email address." };
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Email sending isn't set up yet (RESEND_API_KEY)." };

  // Checks admin rights, never admin accounts, and the 3-per-hour limit; logs the reset.
  const supabase = await createClient();
  const { error: logError } = await supabase.rpc("admin_log_password_reset", { p_member: memberId });
  if (logError) return { ok: false, error: dbError(logError.message, "Couldn't send the reset email.") };

  const { data: link, error } = await svc.auth.admin.generateLink({ type: "recovery", email });
  const token = link?.properties?.hashed_token;
  if (error || !token) return { ok: false, error: "Couldn't create a reset link. Try again." };
  const href = `${APP}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery&next=/reset-password`;
  const { data: p } = await svc.from("profiles").select("full_name").eq("id", memberId).maybeSingle();
  try {
    await sendPartnerPasswordReset(email, p?.full_name ?? "", href);
  } catch {
    return { ok: false, error: "The email service didn't accept the message. Try again in a minute." };
  }
  refresh();
  return { ok: true, message: `Reset link sent to ${email}` };
}

/** Suspend a member (they're signed out and can't sign in) or lift the suspension. */
export async function setSuspension(memberId: string, suspend: boolean, reason = ""): Promise<ActionResult> {
  await requireAdmin("contacts.manage");
  if (!ID.test(memberId)) return { ok: false, error: "Unknown member." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspension", { p_member: memberId, p_suspend: suspend, p_reason: reason.slice(0, 500) });
  if (error) return { ok: false, error: dbError(error.message, suspend ? "Couldn't suspend the account." : "Couldn't lift the suspension.") };
  const { error: banError } = await createServiceClient().auth.admin.updateUserById(memberId, { ban_duration: suspend ? BAN_FOREVER : "none" });
  if (banError) {
    // Keep the record and the sign-in block in step: undo the record if the sign-in ban didn't apply.
    await supabase.rpc("admin_set_suspension", { p_member: memberId, p_suspend: !suspend, p_reason: "" });
    return { ok: false, error: "The sign-in service didn't accept the change. Try again." };
  }
  refresh();
  return { ok: true, message: suspend ? "Account suspended" : "Suspension lifted" };
}
