/** Shared shapes and checks for program, masterclass, show and service details (Phase 11). */

export type Person = { name: string; title: string; linkedin?: string; photo?: string };

/** Host and guest photos come from our public upload bucket only. */
export function cleanPhoto(v: unknown): string {
  const raw = String(v ?? "").trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/content-images\/[\w/.-]{1,200}\.(jpg|png|webp)$/.test(raw) ? raw : "";
}

/** A LinkedIn profile or company page address, or "" when it isn't one. */
export function cleanLinkedIn(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return "";
    if (!/^\/(in|company|school|pub)\/[^/]+/i.test(u.pathname)) return "";
    return `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`.slice(0, 200);
  } catch {
    return "";
  }
}
export type Session = { title: string; hours: number };

export const MAX_PEOPLE = 10;
export const MAX_SESSIONS = 40;
export const MAX_LIST = 20;

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Hosts or guests from the editor (JSON). Drops empty rows; at most 10. */
export function parsePeople(json: string | null | undefined): Person[] {
  try {
    const raw = JSON.parse(json || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((p) => {
        const linkedin = cleanLinkedIn(p?.linkedin);
        const photo = cleanPhoto(p?.photo);
        return { name: clean(p?.name, 80), title: clean(p?.title, 120), ...(linkedin ? { linkedin } : {}), ...(photo ? { photo } : {}) };
      })
      .filter((p) => p.name)
      .slice(0, MAX_PEOPLE);
  } catch {
    return [];
  }
}

/** A message naming the first host or guest whose LinkedIn link isn't a LinkedIn profile, or null. */
export function peopleLinkError(json: string | null | undefined, label: string): string | null {
  try {
    const raw = JSON.parse(json || "[]");
    if (!Array.isArray(raw)) return null;
    for (const p of raw) {
      const link = String(p?.linkedin ?? "").trim();
      if (link && !cleanLinkedIn(link)) return `The LinkedIn link for ${String(p?.name ?? "").trim() || `a ${label}`} doesn't look right. Use a profile link like linkedin.com/in/name.`;
    }
    return null;
  } catch {
    return null;
  }
}

/** Outline sessions from the editor (JSON). Hours are rounded to the nearest quarter, 0.25 to 100. */
export function parseOutline(json: string | null | undefined): Session[] {
  try {
    const raw = JSON.parse(json || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s) => {
        const h = Math.round(Number(String(s?.hours ?? "").replace(",", ".")) * 4) / 4;
        return { title: clean(s?.title, 120), hours: Number.isFinite(h) ? Math.min(100, Math.max(0.25, h)) : 1 };
      })
      .filter((s) => s.title)
      .slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

/** Lists typed one per line (pre-requisites, activities, offerings): trimmed, no blanks or repeats, at most 20. */
export function parseList(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const v = clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""), 200);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out.slice(0, MAX_LIST);
}

export const totalHours = (outline: Session[]) => outline.reduce((n, s) => n + s.hours, 0);

/** 1 → "1 hr", 1.5 → "1.5 hrs", 0.25 → "15 min". */
export function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  const n = Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100);
  return `${n} hr${h === 1 ? "" : "s"}`;
}

/** "Ahmed Fouad & Karim Hemdan" for cards. */
export function namesOf(people: Person[]) {
  const n = people.map((p) => p.name);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} & ${n[n.length - 1]}`;
}
