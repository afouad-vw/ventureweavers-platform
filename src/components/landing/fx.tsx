"use client";

import { useEffect, useRef } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Marks elements with [data-reveal] as in view (data-in) once, for the CSS reveal transitions. */
export function RevealOnScroll() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (reduced() || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.setAttribute("data-in", ""); io.unobserve(en.target); } }),
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    document.documentElement.classList.add("lp-js");
    return () => io.disconnect();
  }, []);
  return null;
}

/** 3D tilt with a light glare that follows the pointer (fine pointers only). */
export function Tilt({ children, className, max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
        el.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
        el.style.setProperty("--gx", `${x * 100}%`);
        el.style.setProperty("--gy", `${y * 100}%`);
        el.style.setProperty("--glare", "1");
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--glare", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [max]);
  return <div ref={ref} className={`lp-tilt ${className ?? ""}`}>{children}<span className="lp-glare" aria-hidden="true" /></div>;
}

/** A link that leans towards the pointer. */
export function Magnetic({ children, href, className, strength = 0.3 }: { children: React.ReactNode; href: string; className?: string; strength?: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
    };
    const leave = () => { el.style.transform = ""; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [strength]);
  return <a ref={ref} href={href} className={`lp-magnet ${className ?? ""}`}>{children}</a>;
}

/** Sets --p (0 to 1) on the element as it scrolls through the viewport, for scroll-linked effects. */
export function ScrollProgress({ children, className, as: Tag = "div", id, exit, style }: { children: React.ReactNode; className?: string; as?: "div" | "section"; id?: string; exit?: boolean; style?: React.CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) { el.style.setProperty("--p", "1"); return; }
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // exit: 0 while the element fills the top of the screen, 1 once it has scrolled away.
      const raw = exit ? -r.top / Math.max(1, r.height) : (vh - r.top) / (r.height + vh * 0.6);
      const p = Math.min(1, Math.max(0, raw));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [exit]);
  return <Tag ref={ref as never} id={id} className={className} style={style}>{children}</Tag>;
}

/** The nav becomes a solid glass bar once the page scrolls. */
export function NavScroll() {
  useEffect(() => {
    const nav = document.getElementById("lp-nav");
    if (!nav) return;
    const on = () => nav.toggleAttribute("data-scrolled", window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return null;
}

/**
 * Cards that pin and stack as you scroll: each card sticks, the next slides over it and the one beneath
 * sinks back (--q, 0 to 1). A card taller than the screen scrolls fully into view before it sticks.
 */
export function StackDeck({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = [...root.querySelectorAll<HTMLElement>(":scope > [data-stack]")];
    let raf = 0;
    const update = () => {
      cards.forEach((c, i) => {
        const next = cards[i + 1];
        if (!next || reduced()) { c.style.setProperty("--q", "0"); return; }
        const gap = next.getBoundingClientRect().top - c.getBoundingClientRect().top;
        c.style.setProperty("--q", Math.min(1, Math.max(0, 1 - gap / Math.max(1, c.offsetHeight))).toFixed(3));
      });
    };
    const layout = () => {
      const vh = window.innerHeight, desk = window.innerWidth >= 900;
      cards.forEach((c, i) => {
        const top = (desk ? 96 : 72) + i * (desk ? 18 : 10);
        c.style.top = `${Math.min(top, vh - c.offsetHeight - 12)}px`;
      });
      update();
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    layout();
    const ro = new ResizeObserver(layout);
    cards.forEach((c) => ro.observe(c));
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", layout);
    return () => { ro.disconnect(); window.removeEventListener("scroll", on); window.removeEventListener("resize", layout); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className={`lp-deck ${className ?? ""}`}>{children}</div>;
}

/**
 * A pinned section whose row of cards travels sideways as you scroll down. With reduced motion it
 * becomes a plain row you can swipe.
 */
export function HScroll({ head, children, label }: { head: React.ReactNode; children: React.ReactNode; label: string }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const s = section.current, t = track.current;
    if (!s || !t) return;
    if (reduced()) { s.setAttribute("data-still", ""); return; }
    let raf = 0, over = 0;
    const update = () => {
      const p = over > 0 ? Math.min(1, Math.max(0, -s.getBoundingClientRect().top / over)) : 0;
      t.style.transform = `translate3d(${(-p * over).toFixed(1)}px,0,0)`;
      if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(3)})`;
    };
    const layout = () => {
      over = Math.max(0, t.scrollWidth - (t.parentElement?.clientWidth ?? window.innerWidth));
      s.style.height = `${over + window.innerHeight}px`;
      update();
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(t);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", layout);
    return () => { ro.disconnect(); window.removeEventListener("scroll", on); window.removeEventListener("resize", layout); cancelAnimationFrame(raf); };
  }, []);
  return (
    <section ref={section} className="lp-h relative" aria-label={label}>
      <div className="lp-h-pin flex flex-col justify-center gap-8 overflow-hidden py-20 desk:gap-12">
        <div className="mx-auto w-full max-w-[1240px] px-5 desk:px-8">{head}</div>
        <div className="lp-h-view mx-auto w-full max-w-[1240px] px-5 desk:px-8">
          <div ref={track} className="lp-h-track flex w-max gap-4">{children}</div>
        </div>
        <div className="mx-auto w-full max-w-[1240px] px-5 desk:px-8">
          <div className="h-[3px] overflow-hidden rounded-full bg-white/10"><div ref={bar} className="h-full origin-left scale-x-0 rounded-full bg-teal" /></div>
        </div>
      </div>
    </section>
  );
}

/** A statement whose words light up one by one as it scrolls through the screen. */
export function LitStatement({ text, teal = [], className }: { text: string; teal?: string[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = [...el.querySelectorAll<HTMLSpanElement>(":scope > span")];
    if (reduced()) { spans.forEach((s) => s.setAttribute("data-on", "")); return; }
    let raf = 0, last = -1;
    const update = () => {
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      // Starts as the statement enters and is fully lit once its last line is two-thirds up the screen.
      const p = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (r.height + vh * 0.25)));
      const n = Math.round(p * spans.length);
      if (n === last) return;
      last = n;
      spans.forEach((s, i) => s.toggleAttribute("data-on", i < n));
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  const tealSet = new Set(teal.map((w) => w.toLowerCase()));
  return (
    <p ref={ref} className={`lp-lit ${className ?? ""}`}>
      {text.split(" ").map((w, i) => (
        <span key={i} className={tealSet.has(w.replace(/[.,]/g, "").toLowerCase()) ? "lp-lit-teal" : undefined}>{w} </span>
      ))}
    </p>
  );
}
