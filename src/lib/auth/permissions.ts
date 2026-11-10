/**
 * Admin access levels (Phase 14). Super admins (Ahmed, Karim) can do everything; team members get
 * ticked areas, each view-only or manage. "manage" includes "view". The database mirrors this in
 * public.has_perm(); keep the two lists in step (supabase/migrations/20261110000015_admin_team.sql).
 */

export const AREAS = [
  { key: "overview", label: "Overview", levels: ["view"], hint: "Numbers and what needs attention" },
  { key: "contacts", label: "Contacts", levels: ["view", "manage"], hint: "Manage: notes, edit details, password reset, suspend" },
  { key: "requests", label: "Requests", levels: ["view", "manage"], hint: "Manage: move, assign, confirm meetings" },
  { key: "payments", label: "Payments", levels: ["view", "manage"], hint: "Manage: mark paid, cancel, refund, payment requests" },
  { key: "events", label: "Outloud events & shows", levels: ["view", "manage"], hint: "Manage: create and edit events, bookings" },
  { key: "checkin", label: "Door check-in", levels: ["manage"], hint: "Scan tickets at the door" },
  { key: "live", label: "Live mode", levels: ["manage"], hint: "Run a show's live mode and venue screen" },
  { key: "content", label: "Outloud content & blog", levels: ["view", "manage"], hint: "Manage: digital content, blog, topics" },
  { key: "tvs", label: "TVS programs & applications", levels: ["view", "manage"], hint: "Manage: programs, cohorts, masterclasses, applications" },
  { key: "classroom", label: "TVS classroom", levels: ["view", "manage"], hint: "Manage: modules, sessions, review hand-ins" },
  { key: "brickr", label: "BRICKR services", levels: ["view", "manage"], hint: "Manage: create and edit services" },
  { key: "quidquo", label: "QuidQuo", levels: ["view", "manage"], hint: "Manage: stages, build log, waitlist" },
  { key: "library", label: "Library", levels: ["view", "manage"], hint: "Manage: upload and edit resources" },
  { key: "publishing", label: "Publishing", levels: ["manage"], hint: "Send updates to the feed and by email" },
] as const;

export type Area = (typeof AREAS)[number]["key"];
export type Level = "view" | "manage";
export type Perm = `${Area}.${Level}`;

export const ALL_PERMS: Perm[] = AREAS.flatMap((a) => (a.levels as readonly Level[]).map((l) => `${a.key}.${l}` as Perm));
const KNOWN = new Set<string>(ALL_PERMS);

export type AdminAccess = { isSuper: boolean; perms: readonly string[] };

/** Same rule as public.has_perm(): super admins pass; "x.view" passes with "x.view" or "x.manage". */
export function can(a: AdminAccess, p: Perm): boolean {
  if (a.isSuper) return true;
  if (a.perms.includes(p)) return true;
  return p.endsWith(".view") && a.perms.includes(p.replace(/\.view$/, ".manage"));
}

/** Passes when any of the listed permissions passes. */
export function canAny(a: AdminAccess, need: Perm | readonly Perm[]): boolean {
  return (Array.isArray(need) ? need : [need]).some((p) => can(a, p as Perm));
}

/** Keep only known permissions, drop "view" when "manage" is ticked for the same area, sorted. */
export function cleanPerms(input: readonly unknown[]): Perm[] {
  const set = new Set(input.map(String).filter((p) => KNOWN.has(p)));
  for (const p of [...set]) if (p.endsWith(".view") && set.has(p.replace(/\.view$/, ".manage"))) set.delete(p);
  return ALL_PERMS.filter((p) => set.has(p));
}

export const PRESETS: { key: string; label: string; perms: Perm[] }[] = [
  { key: "door", label: "Door staff", perms: ["checkin.manage"] },
  { key: "requests", label: "Requests manager", perms: ["requests.manage", "contacts.view"] },
  { key: "content", label: "Content editor", perms: ["content.manage", "library.manage", "publishing.manage"] },
  { key: "programs", label: "Program manager", perms: ["tvs.manage", "classroom.manage", "contacts.view"] },
];

/** A short line describing someone's access, e.g. "Requests (manage), Contacts (view)". */
export function describePerms(perms: readonly string[]): string {
  const clean = cleanPerms(perms);
  if (!clean.length) return "No access yet";
  return clean
    .map((p) => {
      const [k, l] = p.split(".");
      const area = AREAS.find((a) => a.key === k)!;
      return area.levels.length > 1 ? `${area.label} (${l})` : area.label;
    })
    .join(", ");
}

/** What each admin page needs (any of). Pages not listed are super admin only. */
export const PAGE_PERMS: Record<string, Perm[]> = {
  "/admin": ["overview.view"],
  "/admin/contacts": ["contacts.view"],
  "/admin/requests": ["requests.view"],
  "/admin/payments": ["payments.view"],
  "/admin/outloud": ["events.view", "content.view", "live.manage"],
  "/admin/check-in": ["checkin.manage", "events.manage"],
  "/admin/tvs": ["tvs.view", "classroom.view"],
  "/admin/brickr": ["brickr.view"],
  "/admin/quidquo": ["quidquo.view"],
  "/admin/library": ["library.view"],
  "/admin/publishing": ["publishing.manage"],
};

/** Upload targets (images, brochures, files) are open to anyone who manages content of some kind. */
export const UPLOAD_PERMS: Perm[] = ["content.manage", "tvs.manage", "events.manage", "brickr.manage", "publishing.manage", "library.manage", "classroom.manage"];
