"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth/guards";
import { cleanCalendlyUrl } from "@/lib/calendly";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message: string } | { ok: false; error: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Calendly link (meeting requests) and the custom programs inbox. */
export async function saveSchedulingSettings(form: FormData): Promise<Result> {
  const admin = await requireAdmin("super");
  const rawCal = String(form.get("calendly_url") ?? "").trim();
  const cal = rawCal ? cleanCalendlyUrl(rawCal) : "";
  if (rawCal && !cal) return { ok: false, error: "That isn't a Calendly scheduling link. It looks like calendly.com/your-name." };
  const inbox = String(form.get("custom_program_email") ?? "").trim().toLowerCase();
  if (inbox && !EMAIL.test(inbox)) return { ok: false, error: "Check the custom programs inbox address." };
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert([
    { key: "calendly_url", value: cal, updated_by: admin.userId },
    { key: "custom_program_email", value: inbox, updated_by: admin.userId },
  ]);
  if (error) return { ok: false, error: "Couldn't save the settings." };
  await audit(admin.userId, "settings.scheduling", "site_settings", { after: { calendly_url: cal, custom_program_email: inbox } });
  revalidatePath("/", "layout");
  return { ok: true, message: cal ? "Saved. Request a meeting now opens Calendly." : "Saved. Request a meeting uses the built-in slot picker." };
}

/**
 * Registers our webhook with Calendly (uses CALENDLY_TOKEN and CALENDLY_SIGNING_KEY from Vercel),
 * so cancellations and changes in Calendly reach the Requests inbox.
 */
export async function connectCalendly(): Promise<Result> {
  const admin = await requireAdmin("super");
  const token = process.env.CALENDLY_TOKEN;
  const signingKey = process.env.CALENDLY_SIGNING_KEY;
  if (!token || !signingKey) return { ok: false, error: "Add CALENDLY_TOKEN and CALENDLY_SIGNING_KEY in Vercel first, then redeploy." };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const me = await fetch("https://api.calendly.com/users/me", { headers, cache: "no-store" }).catch(() => null);
  if (!me?.ok) return { ok: false, error: "Calendly didn't accept the token. Check CALENDLY_TOKEN in Vercel." };
  const user = ((await me.json()) as { resource: { uri: string; current_organization: string } }).resource;
  const callback = `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}/api/calendly/webhook`;
  const res = await fetch("https://api.calendly.com/webhook_subscriptions", {
    method: "POST",
    headers,
    body: JSON.stringify({ url: callback, events: ["invitee.created", "invitee.canceled"], organization: user.current_organization, user: user.uri, scope: "user", signing_key: signingKey }),
  }).catch(() => null);
  if (res?.status === 409) return { ok: true, message: "Calendly is already connected." };
  if (!res?.ok) return { ok: false, error: `Calendly didn't create the webhook (${res?.status ?? "no answer"}). Webhooks may need a paid Calendly plan on some accounts.` };
  await audit(admin.userId, "settings.calendly_connect", "site_settings", { after: { callback } });
  return { ok: true, message: "Connected. Cancellations in Calendly now update the inbox." };
}
