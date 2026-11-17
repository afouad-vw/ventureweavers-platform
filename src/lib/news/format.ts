/** Member news submissions (approved 2026-11-17): shared lists, labels and the form check. */

export const NEWS_TYPES = ["Funding round", "Launch", "Partnership", "New hire", "Milestone or award", "Event", "Other"] as const;
export const NEWS_PLACES = ["Either", "Newsletter", "VW Notes"] as const;
export const NEWS_SECTIONS = ["Newsletter", "VW Notes"] as const;
export const NEWS_LIMITS = { headline: 160, summary: 300, details: 3000, business: 120 } as const;

export type NewsStatus = "submitted" | "in_review" | "published" | "declined";
export const NEWS_STATUS: Record<NewsStatus, { label: string; tone: "blue" | "warn" | "ok" | "draft" }> = {
  submitted: { label: "Submitted", tone: "blue" },
  in_review: { label: "In review", tone: "warn" },
  published: { label: "Published", tone: "ok" },
  declined: { label: "Not published", tone: "draft" },
};

export type NewsInput = {
  business_name: string;
  news_type: string;
  headline: string;
  news_date: string;
  summary: string;
  details: string;
  link: string | null;
  image_url: string | null;
  preferred: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  consent: true;
};

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

/** Checks a member's submission. `isImage` says whether an uploaded image address is ours. */
export function parseNews(form: FormData, isImage: (url: string) => boolean, today = new Date()): { ok: true; value: NewsInput } | { ok: false; error: string } {
  const business_name = clean(form.get("business_name"), NEWS_LIMITS.business).replace(/\s+/g, " ");
  const news_type = clean(form.get("news_type"), 40);
  const headline = clean(form.get("headline"), NEWS_LIMITS.headline + 1).replace(/\s+/g, " ");
  const news_date = clean(form.get("news_date"), 10);
  const summary = clean(form.get("summary"), NEWS_LIMITS.summary + 1);
  const details = clean(form.get("details"), NEWS_LIMITS.details + 1);
  const link = clean(form.get("link"), 500);
  const image = clean(form.get("image_url"), 500);
  const preferred = clean(form.get("preferred"), 20);
  const contact_name = clean(form.get("contact_name"), 120);
  const contact_email = clean(form.get("contact_email"), 200).toLowerCase();
  const contact_phone = clean(form.get("contact_phone"), 40);

  if (!business_name) return { ok: false, error: "Choose or type the business this news is about." };
  if (!(NEWS_TYPES as readonly string[]).includes(news_type)) return { ok: false, error: "Choose what kind of news it is." };
  if (headline.length < 3) return { ok: false, error: "Add a headline." };
  if (headline.length > NEWS_LIMITS.headline) return { ok: false, error: `Keep the headline to ${NEWS_LIMITS.headline} characters.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(news_date) || Number.isNaN(Date.parse(news_date))) return { ok: false, error: "Choose the date of the news." };
  const max = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
  if (news_date < "2000-01-01" || news_date > max) return { ok: false, error: "Choose a date within the next year or the past." };
  if (!summary) return { ok: false, error: "Add a short summary." };
  if (summary.length > NEWS_LIMITS.summary) return { ok: false, error: `Keep the summary to ${NEWS_LIMITS.summary} characters.` };
  if (!details) return { ok: false, error: "Add the full details." };
  if (details.length > NEWS_LIMITS.details) return { ok: false, error: `Keep the details to ${NEWS_LIMITS.details.toLocaleString("en-US")} characters.` };
  let safeLink: string | null = null;
  if (link) {
    const withScheme = /^https?:\/\//i.test(link) ? link.replace(/^http:\/\//i, "https://") : `https://${link}`;
    try {
      const u = new URL(withScheme);
      if (!u.hostname.includes(".") || /[\s<>"]/.test(withScheme)) throw new Error();
      safeLink = u.toString();
    } catch {
      return { ok: false, error: "That link doesn't look right. Try something like company.com/news." };
    }
  }
  if (image && !isImage(image)) return { ok: false, error: "Upload the image again." };
  if (!(NEWS_PLACES as readonly string[]).includes(preferred)) return { ok: false, error: "Choose where you'd like it to appear." };
  if (!contact_name) return { ok: false, error: "Add who we should contact with questions." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact_email)) return { ok: false, error: "Add a contact email we can reach." };
  if (form.get("consent") !== "on") return { ok: false, error: "Confirm that this news can be shared publicly." };
  return {
    ok: true,
    value: { business_name, news_type, headline, news_date, summary, details, link: safeLink, image_url: image || null, preferred, contact_name, contact_email, contact_phone: contact_phone || null, consent: true },
  };
}

/** The first draft the team edits: the member's details with the business credited. */
export function draftBody(s: { business_name: string; details: string; link: string | null }): string {
  return `${s.details.trim()}${s.link ? `\n\n[Read more](${s.link})` : ""}\n\n*Shared by ${s.business_name} through VentureWeavers.*`;
}

/** Which section to start from: the member's choice, or Newsletter when they said either. */
export const startSection = (preferred: string) => (preferred === "VW Notes" ? "VW Notes" : "Newsletter");
