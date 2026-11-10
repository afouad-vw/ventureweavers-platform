import type { TagTone } from "@/components/ui/tag";

/** One line in a contact's Activity tab. */
export type TimelineItem = {
  key: string;
  at: string;
  space: TagTone;
  title: string;
  detail?: string;
  status?: string;
  /** Set for things the partners did, e.g. "Ahmed". */
  by?: string;
};

export const TIMELINE_FILTERS = ["All", "Outloud", "TVS", "BRICKR", "QuidQuo", "Partner actions"] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

/** Newest first; ties keep a stable order by key. Drops items without a valid time. */
export function sortTimeline(items: TimelineItem[]): TimelineItem[] {
  return items
    .filter((i) => i.at && !Number.isNaN(new Date(i.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.key.localeCompare(b.key));
}

export function filterTimeline(items: TimelineItem[], f: TimelineFilter): TimelineItem[] {
  if (f === "All") return items;
  if (f === "Partner actions") return items.filter((i) => i.by);
  return items.filter((i) => i.space === f);
}

const FIELD_LABEL: Record<string, string> = {
  full_name: "name",
  phone: "mobile",
  linkedin: "LinkedIn",
  country: "country",
  role: "role",
  goals: "interests",
  contact_prefs: "how we communicate",
};

/** Which profile fields differ between two snapshots, as readable labels. */
export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  return Object.keys(FIELD_LABEL).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)).map((k) => FIELD_LABEL[k]);
}

/** A partner action from the audit log, as a timeline line (null for actions we don't show). */
export function auditItem(row: { id: number | string; action: string; at: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }, by: string): TimelineItem | null {
  const base = { key: `log${row.id}`, at: row.at, space: "House" as TagTone, by };
  switch (row.action) {
    case "member.update": {
      const f = changedFields(row.before, row.after);
      return { ...base, title: "Details edited", detail: f.length ? `Changed ${f.join(", ")}` : undefined };
    }
    case "member.password_reset":
      return { ...base, title: "Password reset email sent" };
    case "member.suspend": {
      const reason = typeof row.after?.reason === "string" && row.after.reason ? row.after.reason : undefined;
      return { ...base, title: "Account suspended", detail: reason };
    }
    case "member.unsuspend":
      return { ...base, title: "Suspension lifted" };
    case "contact.note":
      return { ...base, title: "Notes or tags updated" };
    default:
      return null;
  }
}
