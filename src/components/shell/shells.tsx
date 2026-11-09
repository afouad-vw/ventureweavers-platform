"use client";

import Image from "next/image";
import Link from "next/link";
import { adminMain, adminShared, adminSpaces, memberAccount, memberHome, memberSpaces, memberTabBar } from "@/lib/nav";
import { LogOut } from "lucide-react";
import { AppShell, BellButton, Who } from "./app-shell";

/** Member app layout. Sample member until login arrives in Phase 2. */
export function MemberShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sections={[{ items: [memberHome] }, { label: "Spaces", items: memberSpaces }, { items: [memberAccount] }]}
      searchPlaceholder="Search shows, programs, resources"
      tabBar={memberTabBar}
      topRight={
        <>
          <BellButton count={2} />
          <Who initials="NH" name="Nour Hassan" sub="Founder · Seed" href="/my-space" />
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
          <div className="flex gap-2 px-1.5 text-xs font-bold">
            <Link href="/sign-in" className="text-ink-fg hover:text-white">Sign in</Link>
            <span className="text-ink-muted">·</span>
            <Link href="/join" className="text-teal hover:text-white">Join</Link>
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}

/** Admin console layout. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sections={[{ items: adminMain }, { label: "Spaces", items: adminSpaces }, { label: "Shared", items: adminShared }]}
      searchPlaceholder="Search contacts, events, content"
      crumb="Admin console"
      topRight={<Who initials="FK" name="Fouad & Karim" sub="Owners" href="/admin" />}
      footer={
        <Link href="/admin/sign-in" className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-semibold text-ink-fg hover:bg-ink2 hover:text-white">
          <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
          Sign out
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
