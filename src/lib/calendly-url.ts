/** Calendly scheduling links (safe to use in the browser: no Node modules). */

/** A Calendly scheduling page (calendly.com/name or calendly.com/name/event), cleaned; "" if it isn't one. */
export function cleanCalendlyUrl(v: string): string {
  const raw = v.trim();
  if (!raw) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.hostname !== "calendly.com" && u.hostname !== "www.calendly.com") return "";
    if (!/^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)?\/?$/.test(u.pathname)) return "";
    return `https://calendly.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}
