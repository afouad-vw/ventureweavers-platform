"use client";

import { initialsOf } from "@/lib/initials";

import Image from "next/image";
import Link from "next/link";
import { adminMain, adminShared, adminSpaces, adminTeam, memberAccount, memberHome, memberLive, memberSpaces, memberTabBar } from "@/lib/nav";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { adminSignOut } from "@/app/admin/(gate)/actions";
import { adminHref } from "@/lib/hosts";
import { canAny, PAGE_PERMS, type AdminAccess } from "@/lib/auth/permissions";
import type { NavItem } from "@/lib/nav";
import type { Notice } from "@/lib/notifications/format";
import { AppShell, Who } from "./app-shell";
import { NotificationsBell } from "./notifications-bell";

export type ShellMember = { name: string; initials: string; sub: string; avatar?: string | null } | null;

/** Member app layout. Shows the signed-in member, or Sign in and Join. */
export function MemberShell({ member, live = false, notifications = [], children }: { member: ShellMember; live?: boolean; notifications?: Notice[]; children: React.ReactNode }) {
  return (
    <AppShell
      sections={[{ items: [memberHome] }, { label: "Spaces", items: memberSpaces }, { items: live ? [memberAccount, memberLive] : [memberAccount] }]}
      badges={live ? { "/live": "LIVE" } : undefined}
      searchPlaceholder="Search shows, programs, resources"
      searchAction="/search"
      tabBar={memberTabBar}
      topRight={
        <>
          {member ? (
            <>
              <NotificationsBell initial={notifications} />
              <Who initials={member.initials} name={member.name} sub={member.sub} href="/my-space" avatar={member.avatar} />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden h-9 items-center px-2 text-[13.5px] font-bold text-fg hover:text-link sm:inline-flex">Sign in</Link>
              <Link href="/join" className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-[13.5px] font-bold text-white hover:opacity-90">Join</Link>
            </>
          )}
        </>
      }
      footer={
        <>
          <div className="flex items-center gap-2 px-1.5 text-xs text-ink-muted">
            <span className="flex">
              <Image src="/images/ahmed.jpg" alt="Ahmed Fouad" width={26} height={26} className="h-[26px] w-[26px] rounded-full border-2 border-ink object-cover" />
              <Image src="/images/karim.jpg" alt="Karim Hemdan" width={26} height={26} className="-ml-2.5 h-[26px] w-[26px] rounded-full border-2 border-ink object-cover" />
            </span>
            Hosted by Fouad &amp; Karim
          </div>
          {member ? (
            <form action={signOut}>
              <button type="submit" className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-semibold text-ink-fg hover:bg-ink2 hover:text-white">
                <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
                Sign out
              </button>
            </form>
          ) : (
            <div className="flex gap-2 px-1.5 text-xs font-bold">
              <Link href="/sign-in" className="text-ink-fg hover:text-white">Sign in</Link>
              <span className="text-ink-muted">·</span>
              <Link href="/join" className="text-teal hover:text-white">Join</Link>
            </div>
          )}
        </>
      }
    >
      {children}
    </AppShell>
  );
}

/** Admin console layout. */
export function AdminShell({ base, name, access, children }: { base: string; name: string; access: AdminAccess; children: React.ReactNode }) {
  // Only what this admin may open (Phase 14 access levels).
  const allowed = (i: NavItem) => (PAGE_PERMS[i.href] ? canAny(access, PAGE_PERMS[i.href]) : access.isSuper);
  const at = (items: NavItem[]) => items.filter(allowed).map((i) => ({ ...i, href: adminHref(i.href, base) }));
  const sections = [
    { items: at(adminMain) },
    { label: "Spaces", items: at(adminSpaces) },
    { label: "Shared", items: at(adminShared) },
    ...(access.isSuper ? [{ label: "Settings", items: at([adminTeam]) }] : []),
  ].filter((s) => s.items.length);
  return (
    <AppShell
      sections={sections}
      searchPlaceholder="Search contacts, events, content"
      searchAction={adminHref("/admin/search", base)}
      crumb="Admin console"
      topRight={<Who initials={initialsOf(name)} name={name} sub={access.isSuper ? "Super admin" : "Team"} href={adminHref("/admin", base)} />}
      footer={
        <form action={adminSignOut}>
          <button type="submit" className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-semibold text-ink-fg hover:bg-ink2 hover:text-white">
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}

