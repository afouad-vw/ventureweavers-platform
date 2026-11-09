import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe links for The Floor Notes. The token is a signature of the member's id, so a link
 * only works for the person it was sent to and can't be guessed for anyone else.
 * The signing key is derived from the Supabase secret key, so no extra setting is needed.
 */
function key(secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "") {
  if (!secret) throw new Error("No signing key configured");
  return createHmac("sha256", secret).update("vw-unsubscribe-v1").digest();
}

export function unsubscribeToken(memberId: string, secret?: string) {
  return createHmac("sha256", key(secret)).update(memberId).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(memberId: string, token: string, secret?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(memberId) || !/^[A-Za-z0-9_-]{32}$/.test(token)) return false;
  const a = Buffer.from(unsubscribeToken(memberId, secret));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(origin: string, memberId: string, secret?: string) {
  return `${origin}/api/unsubscribe?u=${memberId}&t=${unsubscribeToken(memberId, secret)}`;
}
