/** Calendly: booking addresses, the scheduling link, and webhook signature checks. Pure helpers (no secrets here). */
import { createHmac, timingSafeEqual } from "node:crypto";

export { cleanCalendlyUrl } from "./calendly-url";

export const EVENT_URI = /^https:\/\/api\.calendly\.com\/scheduled_events\/[A-Za-z0-9-]{8,64}$/;
export const INVITEE_URI = /^https:\/\/api\.calendly\.com\/scheduled_events\/[A-Za-z0-9-]{8,64}\/invitees\/[A-Za-z0-9-]{8,64}$/;

/**
 * Checks the Calendly-Webhook-Signature header ("t=<unix>,v1=<hex>") against the raw body.
 * Rejects signatures older than 5 minutes so captured requests can't be replayed.
 */
export function verifyCalendlySignature(header: string | null, body: string, key: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !key) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  if (Math.abs(nowSec - t) > 300) return false;
  const expected = createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1.toLowerCase(), "hex"));
}
