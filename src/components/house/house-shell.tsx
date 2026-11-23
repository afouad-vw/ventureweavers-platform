"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowLeft, BookMarked, BookOpen, Bookmark, BrickWall, Briefcase, ChevronLeft, ChevronRight, ClipboardList, Compass, Cpu, CreditCard,
  GraduationCap, House, Inbox, LogOut, Megaphone, MessageSquare, Mic, MonitorPlay, Presentation, Radio, Search, SlidersHorizontal, Ticket, User, Users, X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { panelMeta, SLIDES, slideIndex, type DockItem, type SpaceKey } from "@/lib/house";
import type { Notice } from "@/lib/notifications/format";
import { MessagesButton } from "@/components/shell/messages-button";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { SCENES } from "./scenes";
import { SceneView } from "./scene-view";
import "./house.css";

const ICONS: Record<string, LucideIcon> = {
  mic: Mic, cap: GraduationCap, bricks: BrickWall, cpu: Cpu, user: User, radio: Radio, play: MonitorPlay, book: BookOpen, board: Presentation,
  users: Users, brief: Briefcase, compass: Compass, activity: Activity, list: ClipboardList, ticket: Ticket, learn: BookMarked, inbox: Inbox,
  card: CreditCard, mega: Megaphone, mark: Bookmark, sliders: SlidersHorizontal, out: LogOut, msg: MessageSquare, search: Search, house: House,
};

export type HouseMember = { name: string; firstName: string; initials: string; avatar?: string | null } | null;

const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The member app as one screen: the animated house in the middle with a slide per space, round icons for
 * each space's sections, and every member page opening in a pop-up panel over the house.
 */
export function HouseShell({ member, live = false, notifications = [], unreadMessages = 0, children }: {
  member: HouseMember; live?: boolean; notifications?: Notice[]; unreadMessages?: number; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const track = useRef<HTMLDivElement>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  const pager = useRef<HTMLElement>(null);
  const [slide, setSlide] = useState(0);
  const panelOpen = pathname !== "/";
  const meta = panelMeta(pathname, params.toString());

  const go = useCallback((i: number, smooth = true) => {
    const k = Math.max(0, Math.min(SLIDES.length - 1, i));
    const el = track.current;
    if (el) el.scrollTo({ left: k * el.clientWidth, behavior: smooth && !still() ? "smooth" : "auto" });
    setSlide(k);
  }, []);

  // A page opens over its own space.
  useEffect(() => {
    if (panelOpen) go(slideIndex(meta.space === "house" ? (SLIDES[slide]?.key ?? "house") : meta.space), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, panelOpen, meta.space]);

  // "/?s=tvs" opens the house on a space.
  useEffect(() => {
    const s = params.get("s") as SpaceKey | null;
    if (!panelOpen && s) go(slideIndex(s), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, panelOpen]);

  // Each new page starts at the top of the panel.
  useEffect(() => { panelBody.current?.scrollTo({ top: 0 }); }, [pathname, params]);

  // On phones the row of space names scrolls: keep the current one in view.
  useEffect(() => {
    const row = pager.current, btn = row?.children[slide] as HTMLElement | undefined;
    if (row && btn && row.scrollWidth > row.clientWidth) row.scrollTo({ left: btn.offsetLeft - (row.clientWidth - btn.offsetWidth) / 2, behavior: still() ? "auto" : "smooth" });
  }, [slide]);

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== slide) setSlide(i);
  };

  // Keep the current slide in place when the window resizes.
  useEffect(() => {
    const on = () => track.current?.scrollTo({ left: slide * (track.current?.clientWidth ?? 0) });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [slide]);

  const close = useCallback(() => router.push(`/?s=${SLIDES[slide].key}`, { scroll: false }), [router, slide]);
  const back = () => (window.history.length > 1 ? router.back() : close());

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog][aria-modal=true]:not(.hs-panel)")) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, close]);

  const toSpace = (key: SpaceKey) => {
    if (panelOpen) router.push(`/?s=${key}`, { scroll: false });
    go(slideIndex(key));
  };

  const PanelIcon = ICONS[meta.icon] ?? House;
  const next = SLIDES[Math.min(SLIDES.length - 1, slide + 1)];

  return (
    <div className={`vw-house hs ${panelOpen ? "hs-paused" : ""}`}>
      <div className="hs-bg" aria-hidden="true">
        <span className="hs-orb a" />
        <span className="hs-orb b" />
        <span className="hs-glow" style={{ backgroundColor: SLIDES[slide].colour }} />
        <span className="hs-grain" />
      </div>

      <header className="hs-top">
        <Link href="/?s=house" className="hs-logo" aria-label="VentureWeavers home" onClick={() => go(0)}>
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={176} height={12} priority />
        </Link>
        <nav className="hs-pager" aria-label="Spaces" ref={pager}>
          {SLIDES.map((s, i) => (
            <button key={s.key} type="button" className={`hs-pg ${i === slide ? "on" : ""}`} style={{ "--c": s.colour } as React.CSSProperties} aria-label={s.short} aria-current={i === slide ? "true" : undefined} onClick={() => toSpace(s.key)}>
              <i /><span>{s.short}</span>
            </button>
          ))}
        </nav>
        <div className="hs-top-r">
          {live ? <Link href="/live" className="hs-live">Live</Link> : null}
          {member ? (
            <>
              <NotificationsBell initial={notifications} />
              <MessagesButton initial={unreadMessages} />
              <button type="button" className={`hs-me ${slide === 5 && !panelOpen ? "on" : ""}`} aria-label="My space" onClick={() => toSpace("me")}>
                {member.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- member photo, cropped to a circle
                  <img src={member.avatar} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="hs-initials">{member.initials}</span>
                )}
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hs-btn ghost">Sign in</Link>
              <Link href="/join" className="hs-btn pri">Join</Link>
            </>
          )}
        </div>
      </header>

      <main className="hs-stage" aria-hidden={panelOpen ? true : undefined} inert={panelOpen ? true : undefined}>
        <div className="hs-track" ref={track} onScroll={onScroll}>
          {SLIDES.map((s, i) => (
            <section key={s.key} className={`hs-slide ${i === slide ? "on" : ""}`} aria-label={s.name} style={{ "--c": s.colour, "--t": s.tint } as React.CSSProperties}>
              <div className="hs-scene-wrap">
                {s.key === "me" ? <MeHero member={member} /> : <SceneView scene={SCENES[s.key]!} eager={i <= 1} onSpot={toSpace} />}
              </div>
              <div className="hs-cap">
                <span className="hs-kick">{s.key === "me" && member ? `Welcome back, ${member.firstName}` : s.kicker}</span>
                {i === 0 ? (
                  <h1 className="hs-ttl hs-ttl-logo">
                    <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={360} height={25} />
                  </h1>
                ) : (
                  <h2 className="hs-ttl">{s.name}</h2>
                )}
                <p className="hs-line">{s.line}</p>
              </div>
              {s.dock.length ? <Dock items={s.dock} onSpace={toSpace} /> : null}
            </section>
          ))}
        </div>
        <button type="button" className={`hs-nav prev ${slide === 0 ? "off" : ""}`} aria-label="Previous space" onClick={() => go(slide - 1)}><ChevronLeft size={22} aria-hidden="true" /></button>
        <button type="button" className={`hs-nav next ${slide === SLIDES.length - 1 ? "off" : ""}`} aria-label={`Next space: ${next.short}`} onClick={() => go(slide + 1)}>
          <span className="hs-nx">{next.short}</span><ChevronRight size={22} aria-hidden="true" />
        </button>
      </main>

      {panelOpen ? (
        <>
          <div className="hs-shade" onClick={close} aria-hidden="true" />
          <div className="hs-panel" role="dialog" aria-modal="true" aria-label={meta.title} style={{ "--c": meta.colour, "--t": meta.tint } as React.CSSProperties}>
            <div className="hs-p-h">
              {meta.detail ? (
                <button type="button" className="hs-back" onClick={back}><ArrowLeft size={16} aria-hidden="true" />Back</button>
              ) : (
                <span className="hs-chip"><PanelIcon size={17} aria-hidden="true" /></span>
              )}
              <span className="hs-crumb">
                {meta.space !== "house" ? <><span>{meta.spaceName}</span><ChevronRight size={15} aria-hidden="true" /></> : null}
                <b>{meta.title}</b>
              </span>
              <button type="button" className="hs-x" aria-label="Close" onClick={close}><X size={18} aria-hidden="true" /></button>
            </div>
            <div className={`hs-p-b hs-in-${meta.space}`} ref={panelBody}>
              <div className="hs-p-inner">
                {meta.detail ? null : (
                  <div className="hs-p-head">
                    <h1 className="hs-p-title">{meta.title}</h1>
                    {meta.sub ? <p className="hs-p-sub">{meta.sub}</p> : null}
                  </div>
                )}
                {children}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div hidden>{children}</div>
      )}
    </div>
  );
}

function MeHero({ member }: { member: HouseMember }) {
  return (
    <div className="hs-me-hero">
      <div className="hs-ring">
        <div className="hs-orbit" aria-hidden="true">
          <i style={{ "--c": "#E39B2D", left: "50%", top: -6 } as React.CSSProperties} />
          <i style={{ "--c": "#1F4FA3", right: -6, top: "50%" } as React.CSSProperties} />
          <i style={{ "--c": "#B5532F", left: "50%", bottom: -6 } as React.CSSProperties} />
          <i style={{ "--c": "#8DBF2E", left: -6, top: "50%" } as React.CSSProperties} />
        </div>
        {member?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- member photo, cropped to a circle
          <img src={member.avatar} alt={member.name} referrerPolicy="no-referrer" />
        ) : (
          <span className="hs-ring-initials" aria-label={member?.name ?? "Member"}>{member?.initials ?? "VW"}</span>
        )}
      </div>
      <Link href="/my-space?tab=tickets" className="hs-float" style={{ "--c": "#F2B65A", left: "8%", top: "14%" } as React.CSSProperties}><small>Tickets</small><b>Your seats</b></Link>
      <Link href="/my-space?tab=learning" className="hs-float" style={{ "--c": "#8AAEF0", right: "6%", top: "20%", animationDelay: "-2s" } as React.CSSProperties}><small>Learning</small><b>Your programs</b></Link>
      <Link href="/my-space?tab=requests" className="hs-float wide" style={{ "--c": "#E8896A", left: "12%", bottom: "14%", animationDelay: "-4s" } as React.CSSProperties}><small>Requests</small><b>Your meetings</b></Link>
      <Link href="/quidquo?tab=waitlist" className="hs-float wide" style={{ "--c": "#B4DD5E", right: "10%", bottom: "12%", animationDelay: "-6s" } as React.CSSProperties}><small>QuidQuo</small><b>Waiting list</b></Link>
    </div>
  );
}

function Dock({ items, onSpace }: { items: DockItem[]; onSpace: (k: SpaceKey) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const more = items.length > 5;
  const nudge = () => {
    const el = row.current;
    if (!el) return;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    el.scrollTo({ left: end ? 0 : el.scrollLeft + 220, behavior: still() ? "auto" : "smooth" });
  };
  return (
    <div className={`hs-dock ${more ? "more" : "few"}`}>
      <div className="hs-dock-row" ref={row}>
        {items.map((d) => {
          const Icon = ICONS[d.icon] ?? House;
          const inner = (
            <>
              <span className="hs-o-c"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
              <span className="hs-o-l">{d.label}</span>
            </>
          );
          const style = { "--c": d.colour } as React.CSSProperties;
          if (d.signOut) {
            return (
              <form key={d.label} action={signOut} className="hs-o-form">
                <button type="submit" className="hs-o" style={style}>{inner}</button>
              </form>
            );
          }
          if (d.href.startsWith("#")) {
            return <button key={d.label} type="button" className="hs-o" style={style} onClick={() => onSpace(d.href.slice(1) as SpaceKey)}>{inner}</button>;
          }
          return <Link key={d.label} href={d.href} scroll={false} className="hs-o" style={style}>{inner}</Link>;
        })}
      </div>
      {more ? <button type="button" className="hs-dock-more" aria-label="Show more" onClick={nudge}><ChevronRight size={16} aria-hidden="true" /></button> : null}
    </div>
  );
}
