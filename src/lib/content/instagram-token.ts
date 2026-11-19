import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The Instagram access token lives in `integration_tokens` (server only), pasted by a super admin in
 * Admin › Outloud › Digital content. Long-lived Instagram tokens last 60 days; the daily cron renews it
 * once a week so it never runs out. INSTAGRAM_ACCESS_TOKEN in the environment is the fallback.
 */

const GRAPH = "https://graph.instagram.com";
const RENEW_AFTER_DAYS = 7;

export type InstagramTokenStatus = { connected: boolean; fromEnv: boolean; expiresAt: string | null; lastError: string | null };

type Row = { token: string; expires_at: string | null; refreshed_at: string; last_error: string | null };

async function row(): Promise<Row | null> {
  if (!supabaseConfigured) return null;
  const { data } = await createServiceClient().from("integration_tokens").select("token, expires_at, refreshed_at, last_error").eq("provider", "instagram").maybeSingle();
  return (data as Row | null) ?? null;
}

export async function getInstagramToken(): Promise<string | null> {
  return (await row())?.token ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? null;
}

async function graph(path: string, token: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${GRAPH}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

const expiry = (json: Record<string, unknown> | null) => {
  const s = Number(json?.expires_in);
  return Number.isFinite(s) && s > 0 ? new Date(Date.now() + s * 1000).toISOString() : null;
};

/** Checks a pasted token against Instagram, renews it when Instagram allows, and stores it. */
export async function saveInstagramToken(token: string, adminId: string | null): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const me = await graph("/me?fields=user_id,username", token).catch(() => null);
  const username = typeof me?.json?.username === "string" ? me.json.username : null;
  if (!me || me.status !== 200 || !username) return { ok: false, error: "Instagram didn't accept that token. Generate a new one and paste it again." };
  // A brand-new token can't be renewed for its first 24 hours; that's fine, the cron renews it later.
  const r = await graph("/refresh_access_token?grant_type=ig_refresh_token", token).catch(() => null);
  const fresh = r?.status === 200 && typeof r.json?.access_token === "string" ? (r.json.access_token as string) : token;
  const now = new Date().toISOString();
  const { error } = await createServiceClient().from("integration_tokens").upsert({
    provider: "instagram",
    token: fresh,
    expires_at: expiry(r?.status === 200 ? r.json : null) ?? new Date(Date.now() + 60 * 86_400_000).toISOString(),
    refreshed_at: now,
    last_error: null,
    updated_at: now,
    updated_by: adminId,
  });
  if (error) return { ok: false, error: "Couldn't save the token." };
  return { ok: true, username };
}

export async function removeInstagramToken(): Promise<void> {
  await createServiceClient().from("integration_tokens").delete().eq("provider", "instagram");
}

/** Daily cron: renew the stored token when the last renewal is a week old. */
export async function renewInstagramToken(): Promise<"renewed" | "not_due" | "none" | "failed"> {
  const r = await row();
  if (!r) return "none";
  if (Date.now() - new Date(r.refreshed_at).getTime() < RENEW_AFTER_DAYS * 86_400_000) return "not_due";
  const svc = createServiceClient();
  const res = await graph("/refresh_access_token?grant_type=ig_refresh_token", r.token).catch(() => null);
  const now = new Date().toISOString();
  if (res?.status === 200 && typeof res.json?.access_token === "string") {
    await svc.from("integration_tokens").update({ token: res.json.access_token as string, expires_at: expiry(res.json), refreshed_at: now, last_error: null, updated_at: now }).eq("provider", "instagram");
    return "renewed";
  }
  await svc.from("integration_tokens").update({ last_error: `Renewal failed (Instagram said ${res?.status ?? "nothing"})`, updated_at: now }).eq("provider", "instagram");
  return "failed";
}

/** For the admin screen: never returns the token itself. */
export async function instagramTokenStatus(): Promise<InstagramTokenStatus> {
  const r = await row();
  if (r) return { connected: true, fromEnv: false, expiresAt: r.expires_at, lastError: r.last_error };
  const env = Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
  return { connected: env, fromEnv: env, expiresAt: null, lastError: null };
}
