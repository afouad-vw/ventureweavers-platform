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
