import "server-only";
import { cache } from "react";
import { emailFrame, esc, sendBatch, type BatchEmail } from "@/lib/email/send";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { peopleById } from "@/lib/tvs/queries";
import { waitItemHref, waitKey, type WaitItemType, type WaitPerson } from "@/lib/waitlist";

const APP = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`;

/** The signed-in member's waitlists, as "type:id" keys. */
export const myWaitlist = cache(async (): Promise<Set<string>> => {
  if (!supabaseConfigured) return new Set();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Set();
  const { data } = await supabase.from("waitlist_entries").select("item_type, item_id").eq("member_id", auth.user.id).limit(500);
  return new Set(((data ?? []) as { item_type: WaitItemType; item_id: string }[]).map((r) => waitKey(r.item_type, r.item_id)));
});

/** Each item's waitlist for the admin screens (row level security limits this to the admin's areas). */
export async function adminWaitlists(type: WaitItemType, ids: string[]): Promise<Record<string, WaitPerson[]>> {
  const out: Record<string, WaitPerson[]> = {};
  if (!supabaseConfigured || !ids.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.from("waitlist_entries").select("item_id, member_id, created_at, notified_at").eq("item_type", type).in("item_id", ids).order("created_at", { ascending: false }).limit(5000);
  const rows = (data ?? []) as { item_id: string; member_id: string; created_at: string; notified_at: string | null }[];
  const people = await peopleById(rows.map((r) => r.member_id));
  for (const r of rows) {
    const p = people.get(r.member_id);
    (out[r.item_id] ??= []).push({ member_id: r.member_id, name: p?.name ?? "Member", email: p?.email ?? null, at: r.created_at, notified: Boolean(r.notified_at) });
  }
  return out;
}

/**
 * Emails everyone the database has just told (bell notification) that an item they waited for is live.
 * Runs after an admin saves a status, and daily from the cron job for anything that failed. Only people told
 * in the last 3 days get an email, so a late send never announces something old. Does nothing without RESEND_API_KEY.
 */
export async function sendWaitlistEmails(): Promise<number> {
  if (!supabaseConfigured || !process.env.RESEND_API_KEY) return 0;
  const svc = createServiceClient();
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data } = await svc.from("waitlist_entries").select("id, item_type, item_id, member_id").is("emailed_at", null).not("notified_at", "is", null).gte("notified_at", since).limit(500);
  const rows = (data ?? []) as { id: string; item_type: WaitItemType; item_id: string; member_id: string }[];
  if (!rows.length) return 0;

  // Titles and addresses of the items.
  const items = new Map<string, { title: string; href: string; program: boolean }>();
  const ids = (t: WaitItemType) => [...new Set(rows.filter((r) => r.item_type === t).map((r) => r.item_id))];
  const [sv, pr, ev] = await Promise.all([
    ids("service").length ? svc.from("services").select("id, slug, name, space").in("id", ids("service")) : { data: [] },
    ids("program").length ? svc.from("programs").select("id, slug, name").in("id", ids("program")) : { data: [] },
    ids("event").length ? svc.from("events").select("id, slug, title, type").in("id", ids("event")) : { data: [] },
  ]);
  for (const x of (sv.data ?? []) as { id: string; slug: string; name: string; space: string }[]) items.set(waitKey("service", x.id), { title: x.name, href: waitItemHref("service", x), program: false });
  for (const x of (pr.data ?? []) as { id: string; slug: string; name: string }[]) items.set(waitKey("program", x.id), { title: x.name, href: waitItemHref("program", x), program: true });
  for (const x of (ev.data ?? []) as { id: string; slug: string; title: string; type: string }[]) items.set(waitKey("event", x.id), { title: x.title, href: waitItemHref("event", x), program: false });

  const people = await peopleById(rows.map((r) => r.member_id));
  const emails: BatchEmail[] = [];
  const done: string[] = [];
  for (const r of rows) {
    const item = items.get(waitKey(r.item_type, r.item_id));
    const p = people.get(r.member_id);
    if (!item || !p?.email) { done.push(r.id); continue; }
    const first = p.name && p.name !== "Member" ? `Hi ${esc(p.name.split(" ")[0])}, ` : "";
    const verb = item.program ? "is now open for applications" : r.item_type === "event" ? "is now open for booking" : "is now open";
    emails.push({
      to: p.email,
      subject: `${item.title} ${verb}`,
      html: emailFrame(
        `${item.title} ${verb}`,
        [`${first}you asked us to tell you when <b>${esc(item.title)}</b> went live. It's ready for you now.`, "You're getting this email because you pressed Notify me in the member app."],
        { label: "Open it", href: `${APP}${item.href}` },
      ),
    });
    done.push(r.id);
  }
  if (emails.length) {
    const res = await sendBatch(emails).catch(() => ({ sent: 0, failed: emails.length }));
    if (!res.sent) return 0;
  }
  if (done.length) await svc.from("waitlist_entries").update({ emailed_at: new Date().toISOString() }).in("id", done);
  return emails.length;
}
