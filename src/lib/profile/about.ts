/** The "About you" details every member gives at sign-up (Phase 12). Shared by the form and the server. */
import { cleanLinkedIn } from "@/lib/details";
import { COUNTRIES, countryByCode } from "./countries";
import { ROLES } from "./options";

export const INTERESTS = ["Education", "Services", "Content", "QuidQuo"] as const;
export const INTEREST_HINT: Record<(typeof INTERESTS)[number], string> = { Education: "TVS", Services: "BRICKR", Content: "Outloud", QuidQuo: "QuidQuo" };
export const CONTACT = ["WhatsApp", "Email", "Call"] as const;

export type About = {
  full_name: string;
  phone: string;
  linkedin: string | null;
  country: string;
  roles: string[];
  goals: string[];
  contact_prefs: string[];
  consent_whatsapp: boolean;
  consent_newsletter: boolean;
};

/** Mirrors public.business_type_list() in the database. */
export const BUSINESS_TYPES = ["Venture", "Angel Investor", "Institutional investor", "Corporate", "Institutional Enabler", "Venture Studio", "Expert", "Mentor", "Other"] as const;
export const MAX_BUSINESSES = 10;

export type Business = { name: string; type: string | null; website: string | null; member_role: string | null; linkedin: string | null };

/** A business LinkedIn page: linkedin.com/company/… (also school, showcase or a personal /in/ page). */
export function cleanCompanyLinkedIn(v: string): string | null {
  const raw = v.trim();
  if (!raw) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || !/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    if (!/^\/(company|school|showcase|in)\/[^/\s<>"]+/i.test(u.pathname)) return null;
    return `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`.slice(0, 200);
  } catch {
    return null;
  }
}

/** Reads the businesses list the form sends as JSON. Empty rows are dropped. */
export function parseBusinesses(raw: unknown): { ok: true; value: Business[] } | { ok: false; error: string } {
  let list: unknown;
  try {
    list = JSON.parse(String(raw ?? "[]") || "[]");
  } catch {
    return { ok: false, error: "We couldn't read your businesses. Please try again." };
  }
  if (!Array.isArray(list)) return { ok: false, error: "We couldn't read your businesses. Please try again." };
  const out: Business[] = [];
  for (const item of list) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const t = (k: string) => String(o[k] ?? "").replace(/\s+/g, " ").trim();
    const name = t("name").slice(0, 120);
    const rawSite = t("website");
    const rawLinkedIn = t("linkedin");
    const member_role = t("member_role").slice(0, 80) || null;
    const type = (BUSINESS_TYPES as readonly string[]).includes(t("type")) ? t("type") : null;
    if (!name && !rawSite && !rawLinkedIn && !member_role && !type) continue;
    if (!name) return { ok: false, error: "Each business needs a name." };
    const website = rawSite ? cleanWebsite(rawSite) : null;
    if (rawSite && !website) return { ok: false, error: `The website for ${name} doesn't look right. Try something like yourcompany.com.` };
    const linkedin = rawLinkedIn ? cleanCompanyLinkedIn(rawLinkedIn) : null;
    if (rawLinkedIn && !linkedin) return { ok: false, error: `The LinkedIn page for ${name} doesn't look right. It should look like linkedin.com/company/name.` };
    out.push({ name, type, website, member_role, linkedin });
  }
  if (out.length > MAX_BUSINESSES) return { ok: false, error: `You can add up to ${MAX_BUSINESSES} businesses.` };
  return { ok: true, value: out };
}

/** "acme.com" → "https://acme.com". Returns null when it isn't a web address. */
export function cleanWebsite(v: string): string | null {
  const raw = v.trim();
  if (!raw) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") || /[\s<>"]/.test(url)) return null;
    return url.slice(0, 200);
  } catch {
    return null;
  }
}

/** "+20" and "01001234567" → "+20 1001234567". Returns null when the number doesn't look right. */
export function joinPhone(dialCountry: string, number: string): string | null {
  const c = countryByCode(dialCountry);
  if (!c) return null;
  let digits = number.replace(/\D/g, "");
  const dialDigits = c.dial.slice(1);
  if (digits.startsWith("00" + dialDigits)) digits = digits.slice(2 + dialDigits.length);
  else if (number.trim().startsWith("+") && digits.startsWith(dialDigits)) digits = digits.slice(dialDigits.length);
  digits = digits.replace(/^0+/, "");
  if (digits.length < 6 || digits.length > 13) return null;
  return `${c.dial} ${digits}`;
}

/** Splits a stored phone back into the country drop-down and the number. */
export function splitPhone(phone: string | null | undefined, fallbackCountry = "EG"): { dialCountry: string; number: string } {
  const m = /^(\+\d{1,4})\s?(\d+)$/.exec((phone ?? "").trim());
  if (!m) return { dialCountry: fallbackCountry, number: (phone ?? "").replace(/[^\d]/g, "") };
  const same = COUNTRIES.filter((c) => c.dial === m[1]);
  const pick = same.find((c) => c.code === fallbackCountry) ?? same[0];
  return { dialCountry: pick?.code ?? fallbackCountry, number: m[2] };
}

export function parseAbout(
  get: (k: string) => unknown,
  getAll: (k: string) => unknown[],
): { ok: true; value: About; businesses: Business[] } | { ok: false; error: string } {
  const s = (k: string) => String(get(k) ?? "").trim();
  const name = s("name").replace(/\s+/g, " ").slice(0, 120);
  if (name.length < 2) return { ok: false, error: "Add your name." };
  const phone = joinPhone(s("dial_country"), s("phone"));
  if (!phone) return { ok: false, error: "Add your mobile number (choose the country code, then the number)." };
  const rawLinkedIn = s("linkedin");
  const linkedin = rawLinkedIn ? cleanLinkedIn(rawLinkedIn) : "";
  if (rawLinkedIn && !linkedin) return { ok: false, error: "That LinkedIn link doesn't look right. It should look like linkedin.com/in/your-name." };
  const country = COUNTRIES.find((c) => c.name === s("country"))?.name;
  if (!country) return { ok: false, error: "Choose your country." };
  const roles = [...new Set(getAll("roles").map(String).filter((x) => (ROLES as readonly string[]).includes(x)))];
  if (!roles.length) return { ok: false, error: "Choose at least one Ecosystem Role." };
  const goals = [...new Set(getAll("interests").map(String).filter((x) => (INTERESTS as readonly string[]).includes(x)))];
  if (!goals.length) return { ok: false, error: "Pick at least one interest." };
  const contact_prefs = [...new Set(getAll("contact").map(String).filter((x) => (CONTACT as readonly string[]).includes(x)))];
  if (!contact_prefs.length) return { ok: false, error: "Choose how we should get in touch." };
  const biz = parseBusinesses(get("businesses"));
  if (!biz.ok) return biz;
  return {
    ok: true,
    value: {
      full_name: name,
      phone,
      linkedin: linkedin || null,
      country,
      roles,
      goals,
      contact_prefs,
      consent_whatsapp: contact_prefs.includes("WhatsApp"),
      consent_newsletter: get("newsletter") === "on",
    },
    businesses: biz.value,
  };
}

/** True when a member still has to complete "About you". */
export function needsAbout(p: { full_name?: string | null; phone?: string | null; country?: string | null; role?: string | null; goals?: string[] | null; contact_prefs?: string[] | null } | null) {
  if (!p) return true;
  return !p.full_name || !p.phone || !p.country || !p.role || !(p.goals ?? []).some((g) => (INTERESTS as readonly string[]).includes(g)) || !(p.contact_prefs ?? []).length;
}
