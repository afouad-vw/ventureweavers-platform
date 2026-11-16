/** Private items (Phase 15): who can see a program, event, service, blog post or Library resource. */

export type ItemType = "program" | "event" | "service" | "blog" | "resource";
export type Visibility = "public" | "private";
/** A person added to a private item: a member (by account) or a contact (by email, matched when they join). */
export type AccessPerson = { member_id?: string; email?: string; name: string };
/** Someone who can be picked from Contacts. */
export type PersonOption = { member_id?: string; email?: string; name: string; sub: string };

export const VISIBILITIES: { value: Visibility; label: string }[] = [
  { value: "public", label: "Public: every member can see it" },
  { value: "private", label: "Private: only the people I add" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const isEmail = (v: string) => EMAIL.test(v.trim()) && v.trim().length <= 200;

/** Reads the people list the form sends as JSON. Keeps members by id and contacts by email, no repeats, at most 500. */
export function parseAccess(raw: unknown): AccessPerson[] {
  let list: unknown;
  try {
    list = JSON.parse(String(raw ?? "[]") || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: AccessPerson[] = [];
  for (const item of list) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const member_id = typeof o.member_id === "string" && UUID.test(o.member_id) ? o.member_id : undefined;
    const email = typeof o.email === "string" && isEmail(o.email) ? o.email.trim().toLowerCase() : undefined;
    if (!member_id && !email) continue;
    const key = member_id ?? `e:${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...(member_id ? { member_id } : {}), ...(email ? { email } : {}), name: String(o.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120) });
    if (out.length === 500) break;
  }
  return out;
}

export const parseVisibility = (v: unknown): Visibility => (v === "private" ? "private" : "public");

/** Where an item lives in the member app (for the invite notification and email). */
export function itemHref(type: ItemType, slug: string, opts: { masterclass?: boolean; id?: string } = {}): string {
  if (type === "program") return `/tvs/programs/${slug}`;
  if (type === "event") return opts.masterclass ? `/tvs/masterclasses/${slug}` : `/outloud/events/${slug}`;
  if (type === "service") return `/brickr/services/${slug}`;
  if (type === "blog") return `/outloud/blog/${slug}`;
  return "/library";
}
