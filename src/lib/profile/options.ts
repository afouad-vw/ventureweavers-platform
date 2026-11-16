/** Onboarding choices, taken from the prototype's join flow. */
/** Ecosystem Roles (members pick one or more). Mirrors public.role_list() in the database. */
export const ROLES = ["Founder", "Angel Investor", "Institutional investor", "Corporate", "Institutional Enabler", "Venture Studio", "Expert", "Mentor", "Exploring the ecosystem"] as const;
/** Venture stages (a business of type Venture, and TVS founder applications). Mirrors public.stage_list(). */
export const STAGES = [
  ["Idea", "Exploring a problem"],
  ["Pre-seed", "Building the first version"],
  ["Seed", "Early customers and revenue"],
  ["Series A", "Scaling the team and market"],
  ["Series B", "Expanding into new markets"],
  ["Series C+", "Growth at scale"],
] as const;
export const GOALS = [
  ["Learn with a cohort", "TVS"],
  ["Hands-on help", "BRICKR"],
  ["Shows & people", "Outloud"],
  ["Raise capital", "QuidQuo"],
] as const;
export const TOPICS = ["Growth", "Fundraising", "Hiring", "Pricing", "Product", "Investing", "Mentoring", "Operations"] as const;

const roleSet = new Set<string>(ROLES);
const stageSet = new Set<string>(STAGES.map((s) => s[0]));
const goalSet = new Set<string>(GOALS.map((g) => g[0]));
const topicSet = new Set<string>(TOPICS);

/** Keep only known values, so the profile never stores arbitrary text from the form. */
export function cleanOnboarding(input: {
  name: string;
  phone: string;
  role: string;
  stage: string;
  goals: string[];
  topics: string[];
  whatsapp: boolean;
  push: boolean;
  newsletter: boolean;
}) {
  const phone = input.phone.replace(/[^\d+ ]/g, "").trim().slice(0, 32);
  return {
    full_name: input.name.trim().slice(0, 120) || null,
    phone: phone || null,
    role: roleSet.has(input.role) ? input.role : null,
    stage: stageSet.has(input.stage) ? input.stage : null,
    goals: [...new Set(input.goals.filter((g) => goalSet.has(g)))],
    interests: [...new Set(input.topics.filter((t) => topicSet.has(t)))],
    consent_whatsapp: input.whatsapp && Boolean(phone),
    consent_push: input.push,
    consent_newsletter: input.newsletter,
  };
}
