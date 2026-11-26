import { BarChart3, BookOpen, Briefcase, Building2, CreditCard, Flag, FlaskConical, FolderKanban, GraduationCap, House, Inbox, Megaphone, MessageSquare, Mic, Network, Radio, ScanLine, ShieldCheck, User, Users, type LucideIcon } from "lucide-react";

export type Thread = "Outloud" | "TVS" | "BRICKR" | "QuidQuo";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  thread?: Thread;
  /** Short, faded label after the name in the menu, e.g. "Content". */
  kind?: string;
};

export const memberHome: NavItem = { href: "/", label: "Home", icon: House };

export const memberSpaces: NavItem[] = [
  { href: "/outloud", label: "Outloud", icon: Mic, thread: "Outloud", kind: "Content" },
  { href: "/tvs", label: "TVS", icon: GraduationCap, thread: "TVS", kind: "Education" },
  { href: "/brickr", label: "BRICKR", icon: Briefcase, thread: "BRICKR", kind: "Services" },
  { href: "/eureka", label: "Eureka", icon: FlaskConical, thread: "QuidQuo", kind: "Products" },
  { href: "/blong/networking", label: "BLong", icon: Network, kind: "Community" },
  { href: "/library", label: "Library", icon: BookOpen, kind: "Resources" },
];

export const memberAccount: NavItem = { href: "/my-space", label: "My space", icon: User };

/** Shown under My space while live mode is open for a show the member has a ticket to. */
export const memberLive: NavItem = { href: "/live", label: "Live now", icon: Radio };

export const adminMain: NavItem[] = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/contacts", label: "Contacts", icon: Users },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
  { href: "/admin/community", label: "Community", icon: Flag },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
];

export const adminSpaces: NavItem[] = [
  { href: "/admin/outloud", label: "Outloud", icon: Mic, thread: "Outloud" },
  { href: "/admin/tvs", label: "TVS", icon: GraduationCap, thread: "TVS" },
  { href: "/admin/brickr", label: "BRICKR", icon: Briefcase, thread: "BRICKR" },
  { href: "/admin/eureka", label: "Eureka", icon: FlaskConical, thread: "QuidQuo" },
];

export const adminShared: NavItem[] = [
  { href: "/admin/library", label: "Library", icon: BookOpen },
  { href: "/admin/publishing", label: "Publishing", icon: Megaphone },
  { href: "/admin/check-in", label: "Door check-in", icon: ScanLine },
];

/** True when `pathname` is this item's page or one of its sub-pages. */
/** Super admins only (Phase 14). */
export const adminTeam: NavItem = { href: "/admin/team", label: "Team & access", icon: ShieldCheck };

export function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
