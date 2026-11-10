import { ROLES, STAGES } from "@/lib/profile/options";

/** TVS application questions by role (Phase 14). Answers are stored as [{ q, a }] with the question text. */
export type Question = { id: string; label: string; kind: "text" | "long" | "stage" | "choice"; required?: boolean; options?: readonly string[]; placeholder?: string };
export type Role = (typeof ROLES)[number];

const WHY: Question = { id: "why_now", label: "Why this program, and why now?", kind: "long" };

export const QUESTIONS: Record<Role, Question[]> = {
  Founder: [
    { id: "venture", label: "Venture name", kind: "text", required: true },
    { id: "website", label: "Website (optional)", kind: "text", placeholder: "https://" },
    { id: "stage", label: "Stage", kind: "stage", required: true },
    { id: "building", label: "What are you building, and for whom?", kind: "long", required: true },
    { id: "team", label: "Team size", kind: "choice", options: ["Just me", "2–5", "6–20", "21–50", "50+"] },
    { id: "traction", label: "Traction so far (customers, revenue, funding)", kind: "long" },
    WHY,
  ],
  "Investor or angel": [
    { id: "investor_type", label: "How you invest", kind: "choice", required: true, options: ["Angel", "Angel network or syndicate", "VC fund", "Family office", "Corporate venture", "Other"] },
    { id: "ticket", label: "Typical ticket size", kind: "choice", required: true, options: ["Under $25k", "$25k–$100k", "$100k–$500k", "$500k–$2M", "Over $2M"] },
    { id: "sectors", label: "Sectors and stages you invest in", kind: "text", required: true },
    { id: "portfolio", label: "Investments so far (how many, any you can name)", kind: "long" },
    { id: "goal", label: "What do you want from the program?", kind: "long", required: true },
  ],
  "Corporate innovator": [
    { id: "company", label: "Company", kind: "text", required: true },
    { id: "title", label: "Your role", kind: "text", required: true },
    { id: "mandate", label: "Your innovation mandate or what you're working on", kind: "long", required: true },
    { id: "team", label: "Team size", kind: "choice", options: ["Just me", "2–5", "6–20", "21–50", "50+"] },
    { id: "goal", label: "What do you want from the program?", kind: "long", required: true },
  ],
  "Career professional": [
    { id: "current", label: "Current role and company", kind: "text", required: true },
    { id: "years", label: "Years of experience", kind: "choice", options: ["Under 3", "3–7", "8–15", "Over 15"] },
    { id: "aim", label: "What venture role are you aiming for?", kind: "long", required: true },
    WHY,
  ],
  "Expert or mentor": [
    { id: "expertise", label: "Your area of expertise", kind: "text", required: true },
    { id: "experience", label: "Ventures or teams you've worked with", kind: "long" },
    { id: "contribute", label: "How would you like to contribute?", kind: "long", required: true },
  ],
  "Exploring my first venture": [
    { id: "background", label: "Your background", kind: "long", required: true },
    { id: "idea", label: "The problem or idea you're exploring", kind: "long", required: true },
    WHY,
  ],
};

export type Answer = { q: string; a: string };

/** Reads the role's answers from the form. Returns the answers, the stage (if asked) and a summary line. */
export function parseAnswers(role: string, get: (id: string) => unknown): { ok: true; answers: Answer[]; stage: string; summary: string } | { ok: false; error: string } {
  const qs = QUESTIONS[role as Role];
  if (!qs) return { ok: false, error: "Choose what describes you best." };
  const answers: Answer[] = [];
  let stage = "";
  for (const q of qs) {
    const raw = String(get(`q_${q.id}`) ?? "").trim().replace(/[ \t]+/g, " ");
    const label = q.label.replace(/ \(optional\)$/, "");
    if (!raw) {
      if (q.required) return { ok: false, error: `Answer “${label}”.` };
      continue;
    }
    if (raw.length > 1000) return { ok: false, error: `Keep “${label}” under 1,000 characters.` };
    if (q.kind === "stage" && !STAGES.some(([v]) => v === raw)) return { ok: false, error: "Choose a stage from the list." };
    if (q.kind === "choice" && !q.options?.includes(raw)) return { ok: false, error: `Choose an option for “${label}”.` };
    if (q.kind === "stage") stage = raw;
    answers.push({ q: label, a: raw });
  }
  const first = answers.find((x) => qs.find((q) => q.label.replace(/ \(optional\)$/, "") === x.q)?.kind === "long") ?? answers[0];
  return { ok: true, answers, stage, summary: first ? first.a.slice(0, 1000) : "" };
}
