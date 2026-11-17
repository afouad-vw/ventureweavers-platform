/** Business CRM (Phase 15): shared lists and helpers for businesses, deals and activity. */

export const DEAL_TYPES = ["Revenue-based", "Acquisition", "Co-creation", "Branding"] as const;
export const DEAL_TYPE_HINT: Record<(typeof DEAL_TYPES)[number], string> = {
  "Revenue-based": "Paid work: services, programs, retainers",
  Acquisition: "Bringing members or clients in through a partner",
  "Co-creation": "Building a program, show or product together",
  Branding: "Sponsorship and brand partnerships",
};
export const DEAL_STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
export const OPEN_STAGES = ["Lead", "Qualified", "Proposal", "Negotiation"] as const;
export const CURRENCIES = ["EGP", "USD"] as const;
export const ACTIVITY_KINDS = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "task", label: "Task" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
export const isOpen = (stage: string) => (OPEN_STAGES as readonly string[]).includes(stage);

/** "USD 18,000" (no decimals when whole). */
export function money(value: number | null, currency: string): string {
  if (value === null || value === undefined) return "No value yet";
  const n = Number(value);
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
}

/** Open deal value per currency, e.g. "USD 18,000 · EGP 250,000". */
export function pipelineTotal(deals: { stage: string; value: number | null; currency: string }[]): string {
  const sums = new Map<string, number>();
  for (const d of deals) if (isOpen(d.stage) && d.value) sums.set(d.currency, (sums.get(d.currency) ?? 0) + Number(d.value));
  if (!sums.size) return "";
  return [...sums.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([c, v]) => money(v, c)).join(" · ");
}

/** Reads a deal value typed by staff ("18,000", "1.5k" is not accepted). Null when empty, "invalid" when not a number. */
export function parseValue(raw: string): number | null | "invalid" {
  const t = raw.replace(/[,\s]/g, "");
  if (!t) return null;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(t)) return "invalid";
  return Number(t);
}

/** Normalised business name, for spotting the same business written differently. */
export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").replace(/\b(llc|ltd|inc|co|company|the|sae|fz|fze)\b/g, "").replace(/\s+/g, " ").trim();
/** "https://www.NilePay.com/about" → "nilepay.com". */
export function domainOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
