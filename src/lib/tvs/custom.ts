/** TVS custom programs request form: fields and checks (shared by the form and the server). */

export const ORG_TYPES = ["A team", "A portfolio", "A cohort", "An organisation", "Something else"] as const;
export const FORMAT_PREFS = ["Online", "In person", "Either"] as const;

export type CustomRequest = {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  role: string;
  forWho: (typeof ORG_TYPES)[number];
  size: string;
  goals: string;
  format: (typeof FORMAT_PREFS)[number];
  timing: string;
  notes: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max);

/** Validates the form. Returns the cleaned request or the first problem to show. */
export function parseCustomRequest(get: (k: string) => unknown): { ok: true; value: CustomRequest } | { ok: false; error: string } {
  const value: CustomRequest = {
    name: clean(get("name"), 100),
    email: clean(get("email"), 200).toLowerCase(),
    phone: clean(get("phone"), 40),
    organisation: clean(get("organisation"), 160),
    role: clean(get("role"), 100),
    forWho: (ORG_TYPES as readonly string[]).includes(String(get("for_who"))) ? (String(get("for_who")) as CustomRequest["forWho"]) : "Something else",
    size: clean(get("size"), 40),
    goals: String(get("goals") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2000),
    format: (FORMAT_PREFS as readonly string[]).includes(String(get("format"))) ? (String(get("format")) as CustomRequest["format"]) : "Either",
    timing: clean(get("timing"), 120),
    notes: String(get("notes") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1000),
  };
  if (value.name.length < 2) return { ok: false, error: "Add your name." };
  if (!EMAIL.test(value.email)) return { ok: false, error: "Add a valid email so we can reply." };
  if (!value.organisation) return { ok: false, error: "Add your organisation." };
  if (value.goals.length < 20) return { ok: false, error: "Tell us a little more about what you want the program to achieve (a sentence or two)." };
  return { ok: true, value };
}
