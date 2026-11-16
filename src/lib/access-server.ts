import "server-only";
import { parseAccess, parseVisibility, type AccessPerson, type ItemType, type PersonOption } from "@/lib/access";
import { allAuthUsers } from "@/lib/contacts/queries";
import { emailFrame, esc, sendEmail } from "@/lib/email/send";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;

/**
 * After an item is saved: store who can see it (from the form's `visibility`, `access` and `access_notify`).
 * The database checks the admin's area. When the item is private, newly added people get a bell
 * notification (members) and an email invite (members and contacts), unless switched off.
 * Returns an error message, or null.
 */
export async function applyAccess(form: FormData, type: ItemType, id: string, title: string, href: string): Promise<string | null> {
  const visibility = parseVisibility(form.get("visibility"));
  const people = parseAccess(form.get("access"));
  const notify = form.get("access_notify") === "on" && visibility === "private";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_item_access", {
    p_type: type,
    p_id: id,
    p_people: people,
    p_title: title.slice(0, 200),
    p_href: notify ? href : null,
    p_notify: notify,
  });
  if (error) return error.message.includes("not_admin") ? "You can't change who sees this item." : "Saved, but the list of people couldn't be saved. Try again.";
  if (notify && process.env.RESEND_API_KEY) await sendInvites((data ?? []) as AccessPerson[], title, href).catch(() => null);
  return null;
}

async function sendInvites(added: AccessPerson[], title: string, href: string) {
  if (!added.length) return;
  const svc = createServiceClient();
  const link = `${APP}${href}`;
  await Promise.all(
    added.map(async (p) => {
      const to = p.email ?? (p.member_id ? (await svc.auth.admin.getUserById(p.member_id)).data.user?.email : null);
      if (!to) return;
      const member = Boolean(p.member_id);
      await sendEmail(
        to,
        `You're invited: ${title}`,
        emailFrame(
          "You're invited",
          [
            `${p.name ? `Hi ${esc(p.name.split(" ")[0])}, ` : ""}the VentureWeavers team added you to <b>${esc(title)}</b>. It's private: only the people we invite can see it.`,
            member ? "Open it in the member app to see the details." : "Join VentureWeavers with this email address to see it. It will be waiting for you.",
          ],
          member ? { label: "Open it", href: link } : { label: "Join VentureWeavers", href: `${APP}/join?next=${encodeURIComponent(href)}` },
        ),
      ).catch(() => null);
    }),
  );
}

/** Each item's people list, for the editors (staff with access to that area only, by row level security). */
export async function accessLists(type: ItemType, ids: string[]): Promise<Record<string, AccessPerson[]>> {
  const out: Record<string, AccessPerson[]> = {};
  if (!supabaseConfigured || !ids.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.from("item_access").select("item_id, member_id, email, name").eq("item_type", type).in("item_id", ids).order("created_at");
  const rows = (data ?? []) as { item_id: string; member_id: string | null; email: string | null; name: string | null }[];
  // Names for members, from their profiles (the name typed when they were added may be out of date).
  const memberIds = [...new Set(rows.map((r) => r.member_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (memberIds.length) {
    const { data: profs } = await createServiceClient().from("profiles").select("id, full_name").in("id", memberIds);
    for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) if (p.full_name) names.set(p.id, p.full_name);
  }
  for (const r of rows) {
    (out[r.item_id] ??= []).push(r.member_id ? { member_id: r.member_id, name: names.get(r.member_id) ?? r.name ?? "Member" } : { email: r.email!, name: r.name ?? r.email! });
  }
  return out;
}

/** Everyone who can be added to a private item: members (not admins) and contacts the partners added. */
export async function personOptions(): Promise<PersonOption[]> {
  if (!supabaseConfigured) return [];
  const svc = createServiceClient();
  const [users, { data: profiles }, { data: admins }, { data: contacts }] = await Promise.all([
    allAuthUsers(),
    svc.from("profiles").select("id, full_name"),
    svc.from("admin_users").select("user_id"),
    svc.from("contacts").select("name, email, company").not("email", "is", null).limit(5000),
  ]);
  const adminIds = new Set(((admins ?? []) as { user_id: string }[]).map((a) => a.user_id));
  const nameOf = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const out: PersonOption[] = [];
  const memberEmails = new Set<string>();
  for (const u of users) {
    if (adminIds.has(u.id)) continue;
    const email = (u.email ?? "").toLowerCase();
    if (email) memberEmails.add(email);
    out.push({ member_id: u.id, name: nameOf.get(u.id) || email || "Member", sub: email ? `Member · ${email}` : "Member" });
  }
  for (const c of (contacts ?? []) as { name: string; email: string; company: string | null }[]) {
    const email = c.email.toLowerCase();
    if (memberEmails.has(email)) continue;
    out.push({ email, name: c.name, sub: `Contact · ${email}${c.company ? ` · ${c.company}` : ""}` });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
