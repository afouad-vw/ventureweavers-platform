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
  role: string;
  goals: string[];
  contact_prefs: string[];
  consent_whatsapp: boolean;
  consent_newsletter: boolean;
};

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

export function parseAbout(get: (k: string) => unknown, getAll: (k: string) => unknown[]): { ok: true; value: About } | { ok: false; error: string } {
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
  const role = (ROLES as readonly string[]).includes(s("role")) ? s("role") : "";
  if (!role) return { ok: false, error: "Choose your role." };
  const goals = [...new Set(getAll("interests").map(String).filter((x) => (INTERESTS as readonly string[]).includes(x)))];
  if (!goals.length) return { ok: false, error: "Pick at least one interest." };
  const contact_prefs = [...new Set(getAll("contact").map(String).filter((x) => (CONTACT as readonly string[]).includes(x)))];
  if (!contact_prefs.length) return { ok: false, error: "Choose how we should get in touch." };
  return {
    ok: true,
    value: {
      full_name: name,
      phone,
      linkedin: linkedin || null,
      country,
      role,
      goals,
      contact_prefs,
      consent_whatsapp: contact_prefs.includes("WhatsApp"),
      consent_newsletter: get("newsletter") === "on",
    },
  };
}

/** True when a member still has to complete "About you". */
export function needsAbout(p: { full_name?: string | null; phone?: string | null; country?: string | null; role?: string | null; goals?: string[] | null; contact_prefs?: string[] | null } | null) {
  if (!p) return true;
  return !p.full_name || !p.phone || !p.country || !p.role || !(p.goals ?? []).some((g) => (INTERESTS as readonly string[]).includes(g)) || !(p.contact_prefs ?? []).length;
}
