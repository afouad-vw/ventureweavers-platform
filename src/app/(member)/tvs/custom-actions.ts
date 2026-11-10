"use server";

import { headers } from "next/headers";
import { getMember } from "@/lib/auth/guards";
import { sendCustomProgramRequest } from "@/lib/email/custom-program";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCustomRequest } from "@/lib/tvs/custom";

type Result = { ok: true } | { ok: false; error: string };
const PER_DAY = 3;

/** TVS custom programs form: emails the custom-programs inbox (set in admin settings). Visitors can send it too. */
export async function sendCustomProgram(form: FormData): Promise<Result> {
  // A hidden field people never see; bots tend to fill it.
  if (String(form.get("website") ?? "")) return { ok: true };
  const parsed = parseCustomRequest((k) => form.get(k));
  if (!parsed.ok) return parsed;
  const r = parsed.value;

  const member = await getMember();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const svc = createServiceClient();

  // At most 3 requests a day from the same connection or account.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  let q = svc.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "custom_program.request").gte("at", since);
  q = member ? q.eq("actor", member.id) : ip ? q.eq("ip", ip) : q.eq("entity_id", r.email);
  const { count } = await q;
  if ((count ?? 0) >= PER_DAY) return { ok: false, error: "We've received your requests today. We'll reply soon." };

  const { data: setting } = await svc.from("site_settings").select("value").eq("key", "custom_program_email").maybeSingle();
  const to = String(setting?.value ?? "").trim();
  if (!to || !process.env.RESEND_API_KEY) return { ok: false, error: "This form isn't switched on yet. Please email us instead." };

  try {
    await sendCustomProgramRequest(to, r, Boolean(member));
  } catch {
    return { ok: false, error: "That didn't send. Please try again in a minute." };
  }
  await svc.from("audit_log").insert({ actor: member?.id ?? null, action: "custom_program.request", entity: "custom_program", entity_id: r.email, ip, after: { organisation: r.organisation, for: r.forWho } });
  return { ok: true };
}
