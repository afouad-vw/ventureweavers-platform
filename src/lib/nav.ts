import {
  BarChart3,
  BookOpen,
  Briefcase,
  Cpu,
  CreditCard,
  GraduationCap,
  House,
  Inbox,
  Megaphone,
  Mic,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Thread = "Outloud" | "TVS" | "BRICKR" | "QuidQuo";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  thread?: Thread;
};

export const memberHome: NavItem = { href: "/", label: "Home", icon: House };

export const memberSpaces: NavItem[] = [
  { href: "/outloud", label: "Outloud", icon: Mic, thread: "Outloud" },
  { href: "/tvs", label: "TVS", icon: GraduationCap, thread: "TVS" },
  { href: "/brickr", label: "BRICKR", icon: Briefcase, thread: "BRICKR" },
  { href: "/quidquo", label: "QuidQuo", icon: Cpu, thread: "QuidQuo" },
  { href: "/library", label: "Library", icon: BookOpen },
];

export const memberAccount: NavItem = { href: "/my-space", label: "My space", icon: User };

/** Bottom bar on phones: four destinations plus a More button that opens the full menu. */
export const memberTabBar: NavItem[] = [memberHome, memberSpaces[0], memberSpaces[1], memberSpaces[2]];

export const adminMain: NavItem[] = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/contacts", label: "Contacts", icon: Users },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
];

export const adminSpaces: NavItem[] = [
  { href: "/admin/outloud", label: "Outloud", icon: Mic, thread: "Outloud" },
  { href: "/admin/tvs", label: "TVS", icon: GraduationCap, thread: "TVS" },
  { href: "/admin/brickr", label: "BRICKR", icon: Briefcase, thread: "BRICKR" },
  { href: "/admin/quidquo", label: "QuidQuo", icon: Cpu, thread: "QuidQuo" },
];

export const adminShared: NavItem[] = [
  { href: "/admin/library", label: "Library", icon: BookOpen },
  { href: "/admin/publishing", label: "Publishing", icon: Megaphone },
];

/** True when `pathname` is this item's page or one of its sub-pages. */
export function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
