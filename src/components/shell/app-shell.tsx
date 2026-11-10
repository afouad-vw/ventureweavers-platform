"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { isActive, type NavItem } from "@/lib/nav";
import { threadDot } from "@/components/ui/tag";

export type NavSection = { label?: string; items: NavItem[] };

function NavLink({ item, pathname, badge }: { item: NavItem; pathname: string; badge?: number | string }) {
  const on = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-semibold",
        on ? "bg-ink2 text-teal" : "text-ink-fg hover:bg-ink2 hover:text-white",
      )}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0 opacity-90" />
      <span>{item.label}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-teal px-1.5 text-[11px] leading-[18px] font-extrabold text-ink">{badge}</span>
      ) : item.thread ? (
        <i className={cn("ml-auto h-[7px] w-[7px] rounded-full", threadDot[item.thread])} aria-hidden="true" />
      ) : null}
    </Link>
  );
}

/**
 * The shared layout for the member app and the admin console:
 * fixed sidebar on desktop (slide-out menu on phones), sticky top bar,
 * and an optional bottom bar on phones.
 */
export function AppShell({
  sections,
  footer,
  topRight,
  searchPlaceholder,
  searchAction,
  crumb,
  tabBar,
  badges = {},
  children,
}: {
  sections: NavSection[];
  footer?: React.ReactNode;
  topRight?: React.ReactNode;
  searchPlaceholder: string;
  /** Where the top-bar search goes (a GET form with ?q=). */
  searchAction: string;
  crumb?: string;
  tabBar?: NavItem[];
  badges?: Record<string, number | string>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh">
      {open ? <div className="fixed inset-0 z-[49] bg-ink/45 desk:hidden" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col gap-px bg-ink text-ink-fg desk:w-[228px] desk:translate-x-0",
          "pt-[calc(18px+env(safe-area-inset-top))] pr-3 pb-[calc(14px+env(safe-area-inset-bottom))] pl-[max(12px,env(safe-area-inset-left))]",
          "overflow-y-auto transition-transform duration-200 desk:overflow-hidden",
          open ? "translate-x-0 shadow-[0_0_40px_rgb(0_0_0/0.35)]" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between pr-1">
          <Link href={sections[0]?.items[0]?.href ?? "/"} className="ml-2 block">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={164} height={12} priority />
          </Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-fg hover:bg-ink2 desk:hidden">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {sections.map((s, i) => (
          <div key={i} className="flex flex-col gap-px">
            {s.label ? <div className="px-2.5 pt-3 pb-1 text-[10.5px] font-extrabold tracking-[1.2px] text-[#7fa49b] uppercase">{s.label}</div> : i > 0 ? <hr className="mx-1 my-2.5 border-ink-line" /> : null}
            {s.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} badge={badges[item.href]} />
            ))}
          </div>
        ))}
        {footer ? <div className="mt-auto flex flex-col gap-2 border-t border-ink-line pt-2.5">{footer}</div> : null}
      </nav>

      <div className="flex min-h-dvh min-w-0 flex-col desk:ml-[228px]">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2.5 border-b border-line bg-card pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] desk:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line2 bg-card text-fg hover:bg-hover desk:hidden">
            <Menu size={18} aria-hidden="true" />
          </button>
          {crumb ? <span className="hidden text-[13px] font-bold whitespace-nowrap text-faint desk:inline">{crumb}</span> : null}
          <form action={searchAction} role="search" className="flex h-9 max-w-[460px] min-w-0 flex-1">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line2 bg-bg px-3 text-faint focus-within:border-primary">
              <Search size={16} aria-hidden="true" className="shrink-0" />
              <span className="sr-only">Search</span>
              <input name="q" type="search" maxLength={80} enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-faint" placeholder={searchPlaceholder} />
            </label>
          </form>
          <span className="flex-1" />
          {topRight}
        </header>

        <main
          className={cn(
            "mx-auto flex w-full max-w-[1240px] flex-col gap-4 pt-4 pr-[max(16px,env(safe-area-inset-right))] pb-14 pl-[max(16px,env(safe-area-inset-left))] desk:gap-[18px] desk:px-6 desk:pt-[22px]",
            tabBar && "pb-[calc(88px+env(safe-area-inset-bottom))] desk:pb-14",
          )}
        >
          {children}
        </main>
      </div>

      {tabBar ? (
        <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-card px-1 pb-[calc(4px+env(safe-area-inset-bottom))] pt-1 desk:hidden">
          {tabBar.map((t) => {
            const on = isActive(pathname, t.href);
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cn("flex min-h-[50px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold", on ? "text-link" : "text-faint")}>
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                {t.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-[50px] cursor-pointer flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-faint">
            <Menu size={20} strokeWidth={1.8} aria-hidden="true" />
            More
          </button>
        </nav>
      ) : null}
    </div>
  );
}

/** Notification bell for the top bar. */
export function BellButton({ count = 0 }: { count?: number }) {
  return (
    <button type="button" aria-label={count ? `Notifications, ${count} unread` : "Notifications"} className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line2 bg-card text-fg hover:bg-hover">
      <Bell size={18} aria-hidden="true" />
      {count ? <span className="absolute -top-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-card bg-teal px-1 text-[10px] font-extrabold text-ink">{count}</span> : null}
    </button>
  );
}

/** Avatar + name block for the top bar. */
export function Who({ initials, name, sub, href }: { initials: string; name: string; sub: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-fg">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[13px] font-bold text-white">{initials}</span>
      <span className="hidden flex-col leading-tight desk:flex">
        <b className="text-[13px]">{name}</b>
        <span className="text-[11.5px] text-faint">{sub}</span>
      </span>
    </Link>
  );
}
