import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminBase, adminHref, SURFACE_HEADER } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { supabaseConfigured } from "@/lib/supabase/env";
import { adminSessionVerdict, clientIp } from "./policy";

/** Local development only: open the admin console without Supabase. Ignored in production builds. */
const devOpen = process.env.NODE_ENV !== "production" && process.env.DEV_OPEN_ADMIN === "1";

export type Member = { id: string; email: string | null; name: string | null; avatar: string | null; onboarded: boolean };

/** The signed-in member, or null. Safe to call from any member page. */
export async function getMember(): Promise<Member | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  const { data: p } = await supabase.from("profiles").select("full_name, avatar_url, onboarded_at").eq("id", sub).maybeSingle();
  return {
    id: sub,
    email: (data.claims.email as string | undefined) ?? null,
    name: p?.full_name ?? null,
    avatar: p?.avatar_url ?? null,
    onboarded: Boolean(p?.onboarded_at),
  };
}

/** For pages that need an account: sends visitors to sign in and back here afterwards. */
export async function requireMember(here: string): Promise<Member> {
  const m = await getMember();
  if (!m) redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  return m;
}

export type Admin = { userId: string; username: string; displayName: string; sessionId: string };

/** Where admin links point on this request (no /admin prefix on the admin host). */
export async function currentAdminBase() {
  return adminBase((await headers()).get(SURFACE_HEADER));
}

/**
 * For every admin page and action. Passes only when the person is signed in, listed in admin_users,
 * and the session is neither idle nor too old. (2-step verification was removed on 2026-11-10, Phase 10.)
 */
export async function requireAdmin(): Promise<Admin> {
  const base = await currentAdminBase();
  const to = (p: string) => adminHref(p, base);

  if (devOpen) return { userId: "dev", username: "dev", displayName: "Local dev", sessionId: "dev" };
  if (!supabaseConfigured) redirect(to("/admin/sign-in"));

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect(to("/admin/sign-in"));

  const svc = createServiceClient();
  const { data: admin } = await svc.from("admin_users").select("username, display_name").eq("user_id", claims.sub).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(to("/admin/sign-in"));
  }

  const sessionId = String(claims.session_id ?? "");
  if (!sessionId) redirect(to("/admin/sign-in"));
  const { data: s } = await svc.from("admin_sessions").select("created_at, last_seen_at, revoked_at").eq("session_id", sessionId).maybeSingle();

  if (!s) {
    await svc.from("admin_sessions").insert({ session_id: sessionId, user_id: claims.sub });
  } else {
    const verdict = adminSessionVerdict({
      createdAt: new Date(s.created_at),
      lastSeenAt: new Date(s.last_seen_at),
      revokedAt: s.revoked_at ? new Date(s.revoked_at) : null,
    });
    if (verdict === "expired") {
      await svc.from("admin_sessions").update({ revoked_at: new Date().toISOString() }).eq("session_id", sessionId).is("revoked_at", null);
      await supabase.auth.signOut({ scope: "local" });
      redirect(to("/admin/sign-in") + "?expired=1");
    }
    if (verdict === "touch") {
      await svc.from("admin_sessions").update({ last_seen_at: new Date().toISOString() }).eq("session_id", sessionId);
    }
  }

  return { userId: claims.sub, username: admin.username, displayName: admin.display_name, sessionId };
}

/** Record an admin change. Call from every server action that creates, edits or deletes something. */
export async function audit(
  actor: string,
  action: string,
  entity: string,
  detail: { entityId?: string; before?: unknown; after?: unknown } = {},
) {
  if (devOpen && actor === "dev") return;
  const ip = clientIp(await headers());
  await createServiceClient().from("audit_log").insert({
    actor,
    action,
    entity,
    entity_id: detail.entityId ?? null,
    before: detail.before ?? null,
    after: detail.after ?? null,
    ip,
  });
}
