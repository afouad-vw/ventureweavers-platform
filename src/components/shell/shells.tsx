"use client";

import { initialsOf } from "@/lib/initials";

import Image from "next/image";
import Link from "next/link";
import { adminMain, adminShared, adminSpaces, memberAccount, memberHome, memberLive, memberSpaces, memberTabBar } from "@/lib/nav";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { adminSignOut } from "@/app/admin/(gate)/actions";
import { adminHref } from "@/lib/hosts";
import type { NavItem } from "@/lib/nav";
import { AppShell, BellButton, Who } from "./app-shell";

export type ShellMember = { name: string; initials: string; sub: string } | null;

/** Member app layout. Shows the signed-in member, or Sign in and Join. */
export function MemberShell({ member, live = false, children }: { member: ShellMember; live?: boolean; children: React.ReactNode }) {
  return (
    <AppShell
      sections={[{ items: [memberHome] }, { label: "Spaces", items: memberSpaces }, { items: live ? [memberAccount, memberLive] : [memberAccount] }]}
      badges={live ? { "/live": "LIVE" } : undefined}
      searchPlaceholder="Search shows, programs, resources"
      tabBar={memberTabBar}
      topRight={
        <>
          {member ? (
            <>
              <BellButton count={0} />
              <Who initials={member.initials} name={member.name} sub={member.sub} href="/my-space" />
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
export function AdminShell({ base, name, children }: { base: string; name: string; children: React.ReactNode }) {
  const at = (items: NavItem[]) => items.map((i) => ({ ...i, href: adminHref(i.href, base) }));
  return (
    <AppShell
      sections={[{ items: at(adminMain) }, { label: "Spaces", items: at(adminSpaces) }, { label: "Shared", items: at(adminShared) }]}
      searchPlaceholder="Search contacts, events, content"
      crumb="Admin console"
      topRight={<Who initials={initialsOf(name)} name={name} sub="Admin" href={adminHref("/admin", base)} />}
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

