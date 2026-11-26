"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowLeft, Bell, BookMarked, BookOpen, Bookmark, Bot, BrickWall, Briefcase, ChevronLeft, ChevronRight, ClipboardList, Compass, Cpu, CreditCard, FlaskConical,
  GraduationCap, House, Inbox, LogOut, Megaphone, MessageSquare, MessagesSquare, Mic, Network, MonitorPlay, Presentation, Radio, Search, SlidersHorizontal, Ticket, User, Users, X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { panelMeta, SLIDES, slideIndex, type DockItem, type SpaceKey } from "@/lib/house";
import type { Notice } from "@/lib/notifications/format";
import { MessagesButton } from "@/components/shell/messages-button";
import { fetchNotifications } from "@/app/(member)/notification-actions";
import { badgeText, unreadCount } from "@/lib/notifications/format";
import { SCENES } from "./scenes";
import { SceneView } from "./scene-view";
import { VwLogo } from "./vw-logo";
import "./house.css";

const ICONS: Record<string, LucideIcon> = {
  mic: Mic, cap: GraduationCap, bricks: BrickWall, cpu: Cpu, user: User, radio: Radio, play: MonitorPlay, book: BookOpen, board: Presentation,
  users: Users, brief: Briefcase, compass: Compass, activity: Activity, list: ClipboardList, ticket: Ticket, learn: BookMarked, inbox: Inbox,
  card: CreditCard, mega: Megaphone, mark: Bookmark, sliders: SlidersHorizontal, out: LogOut, msg: MessageSquare, search: Search, house: House, bell: Bell, chat: MessagesSquare, net: Network, lab: FlaskConical, bot: Bot,
};

export type HouseMember = { name: string; firstName: string; initials: string; avatar?: string | null } | null;

const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The member app as one screen: the animated house in the middle with a slide per space, round icons for
 * each space's sections, and every member page opening in a pop-up panel over the house.
 */
export function HouseShell({ member, live = false, notifications = [], unreadMessages = 0, soon = [], children }: {
  member: HouseMember; live?: boolean; notifications?: Notice[]; unreadMessages?: number; soon?: string[]; children: React.ReactNode;
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

  // Morph: each slide knows how far it is from the centre (--p, -1 to 1) and the CSS slides, scales and fades it.
  // Only slides whose value changed are touched, so off-screen slides cost nothing per frame.
  const frame = useRef(0);
  const last = useRef<string[]>([]);
  const morph = useCallback(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const w = el.clientWidth, x = el.scrollLeft;
    Array.from(el.children).forEach((c, i) => {
      const p = Math.max(-1, Math.min(1, (i * w - x) / w)).toFixed(3);
      if (last.current[i] === p) return;
      last.current[i] = p;
      (c as HTMLElement).style.setProperty("--p", p);
      (c as HTMLElement).style.setProperty("--a", Math.abs(Number(p)).toFixed(3));
    });
  }, []);
  useEffect(() => { morph(); }, [morph]);

  // Desktop moves between spaces with our own eased glide (snapping paused while it runs): the browser's
  // smooth scroll fights scroll-snap there and stutters. Phones keep the native swipe and scroll.
  const glide = useRef(0);
  const stopGlide = useCallback(() => {
    if (!glide.current) return;
    cancelAnimationFrame(glide.current);
    glide.current = 0;
    if (track.current) track.current.style.scrollSnapType = "";
  }, []);
  const go = useCallback((i: number, smooth = true) => {
    const k = Math.max(0, Math.min(SLIDES.length - 1, i));
    const el = track.current;
    setSlide(k);
    if (!el) return;
    stopGlide();
    const to = k * el.clientWidth, from = el.scrollLeft, dist = to - from;
    if (!smooth || still() || Math.abs(dist) < 1) { el.scrollTo({ left: to }); morph(); return; }
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) { el.scrollTo({ left: to, behavior: "smooth" }); return; }
    const slides = Math.abs(dist) / el.clientWidth;
    const ms = Math.min(1100, 620 + (slides - 1) * 140);
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const start = performance.now();
    el.style.scrollSnapType = "none";
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      el.scrollLeft = from + dist * ease(t);
      morph();
      if (t < 1) glide.current = requestAnimationFrame(step);
      else { glide.current = 0; el.style.scrollSnapType = ""; }
    };
    glide.current = requestAnimationFrame(step);
  }, [stopGlide, morph]);
  useEffect(() => stopGlide, [stopGlide]);

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
    // During a glide the target slide is already set and the glide drives the morph itself.
    if (glide.current) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== slide) setSlide(i);
    if (!still()) {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(morph);
    }
  };

  // Desktop: the Left and Right arrow keys move between spaces while no page is open.
  useEffect(() => {
    if (panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true], .hs-dock-row") || document.querySelector("[role=dialog][aria-modal=true]")) return;
      e.preventDefault();
      go(slide + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, slide, go]);

  // Keep the current slide in place when the window resizes.
  useEffect(() => {
    const on = () => { track.current?.scrollTo({ left: slide * (track.current?.clientWidth ?? 0) }); morph(); };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [slide, morph]);

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
          <VwLogo />
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
              <span className="hs-tip" data-tip="Home"><HomeButton /></span>
              <span className="hs-tip" data-tip="Notifications"><NotificationsButton initial={notifications} /></span>
              <span className="hs-tip" data-tip="Messages"><MessagesButton initial={unreadMessages} /></span>
              <span className="hs-tip" data-tip="My space"><button type="button" className={`hs-me ${slide === slideIndex("me") && !panelOpen ? "on" : ""}`} aria-label="My space" onClick={() => toSpace("me")}>
                {member.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- member photo, cropped to a circle
                  <img src={member.avatar} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="hs-initials">{member.initials}</span>
                )}
              </button></span>
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
        <div className="hs-track" ref={track} onScroll={onScroll} onWheel={stopGlide} onPointerDown={stopGlide}>
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
              {s.dock.length ? <Dock items={s.dock} onSpace={toSpace} soon={soon} /> : null}
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

/** Home: the member's dashboard (greeting, what's next, feed). */
function HomeButton() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const on = path === "/updates" && tab !== "notifications";
  return (
    <Link href="/updates" scroll={false} className="hs-ib" aria-label="Home" aria-current={on ? "page" : undefined}>
      <House size={18} aria-hidden="true" />
    </Link>
  );
}

/** Opens Notifications; shows how many are unread. Refreshes every 60 seconds. */
function NotificationsButton({ initial }: { initial: Notice[] }) {
  const [unread, setUnread] = useState(unreadCount(initial));
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const onPage = path === "/updates" && tab === "notifications";
  useEffect(() => {
    const refresh = async () => {
      const next = await fetchNotifications().catch(() => null);
      if (next) setUnread(unreadCount(next));
    };
    if (!onPage) void refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 60_000);
    return () => clearInterval(t);
  }, [onPage]);
  return (
    <Link href="/updates?tab=notifications" scroll={false} className="hs-ib" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-current={onPage ? "page" : undefined}>
      <Bell size={18} aria-hidden="true" />
      {unread ? <span className="hs-badge">{badgeText(unread)}</span> : null}
    </Link>
  );
}

function MeHero({ member }: { member: HouseMember }) {
  return (
    <div className="hs-me-hero">
      <Link href="/my-space?tab=profile" scroll={false} className="hs-ring" aria-label="Profile settings">
        <div className="hs-orbit" aria-hidden="true">
          <i style={{ "--c": "#E39B2D", left: "50%", top: -6 } as React.CSSProperties} />
          <i style={{ "--c": "#1F4FA3", right: -6, top: "50%" } as React.CSSProperties} />
          <i style={{ "--c": "#B5532F", left: "50%", bottom: -6 } as React.CSSProperties} />
          <i style={{ "--c": "#7C5CE0", left: -6, top: "50%" } as React.CSSProperties} />
          <i style={{ "--c": "#8DBF2E", left: "14%", top: "14%" } as React.CSSProperties} />
        </div>
        {member?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- member photo, cropped to a circle
          <img src={member.avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="hs-ring-initials">{member?.initials ?? "VW"}</span>
        )}
        <span className="hs-ring-tip">Profile settings</span>
      </Link>
      <Link href="/my-space?tab=tickets" className="hs-float" style={{ "--c": "#F2B65A", left: "8%", top: "14%" } as React.CSSProperties}><small>Tickets</small><b>Your seats</b></Link>
      <Link href="/my-space?tab=learning" className="hs-float" style={{ "--c": "#8AAEF0", right: "6%", top: "20%", animationDelay: "-2s" } as React.CSSProperties}><small>Learning</small><b>Your programs</b></Link>
      <Link href="/my-space?tab=requests" className="hs-float" style={{ "--c": "#E8896A", left: "12%", bottom: "14%", animationDelay: "-4s" } as React.CSSProperties}><small>Requests</small><b>Your meetings</b></Link>
      <Link href="/my-space?tab=saved" className="hs-float" style={{ "--c": "#5fe0c0", right: "10%", bottom: "12%", animationDelay: "-6s" } as React.CSSProperties}><small>Saved</small><b>Kept for later</b></Link>
    </div>
  );
}

function Dock({ items, onSpace, soon }: { items: DockItem[]; onSpace: (k: SpaceKey) => void; soon: string[] }) {
  const row = useRef<HTMLDivElement>(null);
  const more = items.length > 5;
  // Arrows like the space arrows: left once scrolled, right until the end.
  const [edge, setEdge] = useState({ left: false, right: more });
  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  const nudge = (dir: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: still() ? "auto" : "smooth" });
  };
  return (
    <div className={`hs-dock ${more ? "more" : "few"} ${edge.left ? "at-l" : ""} ${edge.right ? "at-r" : ""}`}>
      <div className="hs-dock-row" ref={row} onScroll={measure}>
        {items.map((d) => {
          const Icon = ICONS[d.icon] ?? House;
          const inner = (
            <>
              <span className="hs-o-c">{/* eslint-disable-next-line @next/next/no-img-element -- small SVG logo */}
              {d.img ? <img src={d.img} alt="" className="hs-o-img" aria-hidden="true" /> : <Icon size={22} strokeWidth={1.7} aria-hidden="true" />}{soon.some((p) => d.href.startsWith(p)) ? <span className="hs-o-soon">Soon</span> : null}</span>
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
      {more && edge.left ? <button type="button" className="hs-dock-more prev" aria-label="Show earlier sections" onClick={() => nudge(-1)}><ChevronLeft size={16} aria-hidden="true" /></button> : null}
      {more && edge.right ? <button type="button" className="hs-dock-more" aria-label="Show more sections" onClick={() => nudge(1)}><ChevronRight size={16} aria-hidden="true" /></button> : null}
    </div>
  );
}
