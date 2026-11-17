"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type Hotspot = { label: string; x: number; y: number; colour: string; href?: string };
export type FlowPath = { colour: string; points: [number, number][] };

/**
 * A 3D render that floats and tilts towards the pointer, with lights travelling along its glowing paths
 * (points in % of the image) and glass labels pinned to places in the scene.
 */
export function FloatingScene({
  src, alt, width, height, hotspots = [], flows = [], priority, className, sizes,
}: {
  src: string; alt: string; width: number; height: number; hotspots?: Hotspot[]; flows?: FlowPath[]; priority?: boolean; className?: string; sizes?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Tilt towards the pointer.
  useEffect(() => {
    const el = wrap.current;
    if (!el || reduced()) return;
    let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const leave = () => { tx = 0; ty = 0; };
    const tick = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      el.style.setProperty("--tx", x.toFixed(3));
      el.style.setProperty("--ty", y.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave); };
  }, []);

  // Lights travelling along the scene's paths.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !flows.length) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, visible = true;
    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    // Precompute each path's length so lights move at an even speed.
    const paths = flows.map((f) => {
      const segs = f.points.slice(1).map((p, i) => Math.hypot(p[0] - f.points[i][0], p[1] - f.points[i][1]));
      return { ...f, segs, total: segs.reduce((a, b) => a + b, 0) };
    });
    const at = (p: (typeof paths)[number], t: number) => {
      let d = t * p.total;
      for (let i = 0; i < p.segs.length; i++) {
        if (d <= p.segs[i]) {
          const k = d / p.segs[i], a = p.points[i], b = p.points[i + 1];
          return [(a[0] + (b[0] - a[0]) * k) / 100 * w, (a[1] + (b[1] - a[1]) * k) / 100 * h];
        }
        d -= p.segs[i];
      }
      const z = p.points.at(-1)!;
      return [z[0] / 100 * w, z[1] / 100 * h];
    };
    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      paths.forEach((p, pi) => {
        for (let k = 0; k < 3; k++) {
          const t = ((time / 1000) * (0.09 + pi * 0.012) + k / 3 + pi * 0.21) % 1;
          // A short comet: a bright head and a fading tail.
          for (let s = 0; s < 10; s++) {
            const [x, y] = at(p, Math.max(0, t - s * 0.006));
            const r = 7 - s * 0.55;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
            g.addColorStop(0, p.colour);
            g.addColorStop(1, "transparent");
            ctx.globalAlpha = (1 - s / 10) * 0.85;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (visible && !reduced()) raf = requestAnimationFrame(draw);
    };
    size();
    if (!reduced()) raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(size);
    ro.observe(c);
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !reduced()) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    });
    io.observe(c);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [flows]);

  return (
    <div ref={wrap} className={`lp-scene ${className ?? ""}`}>
      <div className="lp-scene-inner relative">
        <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes={sizes ?? "(min-width: 900px) 60vw, 100vw"} className="h-auto w-full select-none" draggable={false} />
        {flows.length ? <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" /> : null}
        {hotspots.map((h, i) => {
          const body = (
            <>
              <span className="lp-hot-dot" style={{ background: h.colour, boxShadow: `0 0 0 4px color-mix(in srgb, ${h.colour} 30%, transparent), 0 0 18px ${h.colour}` }} />
              <span className="lp-hot-label">{h.label}</span>
            </>
          );
          const style = { left: `${h.x}%`, top: `${h.y}%`, "--i": i } as React.CSSProperties;
          return h.href ? (
            <a key={h.label} href={h.href} className="lp-hot" style={style}>{body}</a>
          ) : (
            <span key={h.label} className="lp-hot" style={style}>{body}</span>
          );
        })}
      </div>
    </div>
  );
}

export type JourneyStep = { key: string; tab: string; kicker: string; title: string; body: string; cta?: { label: string; href: string }; colour: string; tint: string; cam: { x: number; y: number; s: number }; label: { x: number; y: number } };

/**
 * A pinned scroll story: the section holds still while scrolling moves a camera across one wide scene,
 * step by step, with tabs and a step card beside it.
 */
export function Journey({ src, width, height, steps, eyebrow, title }: { src: string; width: number; height: number; steps: JourneyStep[]; eyebrow: string; title: string }) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      setProgress(p);
      setActive(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)));
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [steps.length]);

  const go = (i: number) => {
    const el = section.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + total * ((i + 0.5) / steps.length), behavior: reduced() ? "auto" : "smooth" });
  };

  const s = steps[active];
  const within = (progress * steps.length) % 1;

  return (
    <section ref={section} className="relative" style={{ height: `${steps.length * 90 + 60}vh` }} aria-label={title}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-6 px-5 pt-16 desk:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] desk:gap-12 desk:px-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-[#050d0e] shadow-[0_40px_100px_-40px_rgb(0_0_0/0.9)] desk:aspect-[5/4]">
            {/* The scene fills the frame's width; the camera moves the chosen point (image %) to the centre and zooms. */}
            <div
              className="lp-cam absolute top-1/2 left-1/2 w-full"
              style={{ aspectRatio: `${width} / ${height}`, transform: `translate(-50%, -50%) scale(${s.cam.s}) translate(${50 - s.cam.x}%, ${50 - s.cam.y}%)` }}
            >
              <Image src={src} alt="" fill sizes="(min-width: 900px) 1600px, 200vw" className="object-cover" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(5_13_14/0.75))]" />
            <span key={s.key} className="lp-pop-label absolute font-mono text-[12px] font-bold tracking-[.18em] uppercase" style={{ left: `${s.label.x}%`, top: `${s.label.y}%`, color: s.tint, borderColor: `color-mix(in srgb, ${s.colour} 60%, transparent)` }}>
              {s.tab}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <p className="lp-eyebrow">{eyebrow}</p>
            <h2 className="font-display text-[28px] leading-[1.08] font-semibold desk:text-[40px]">{title}</h2>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Steps">
              {steps.map((st, i) => (
                <button
                  key={st.key}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => go(i)}
                  className="h-8 cursor-pointer rounded-full border px-3 font-mono text-[11.5px] font-bold transition-colors"
                  style={i === active ? { background: st.colour, borderColor: st.colour, color: "#071112" } : { borderColor: "rgb(255 255 255 / 0.12)", color: "rgb(220 241 221 / 0.6)" }}
                >
                  0{i + 1} {st.tab}
                </button>
              ))}
            </div>
            <div key={s.key} className="lp-step lp-glass rounded-[22px] p-6" role="tabpanel">
              <span className="font-mono text-[11px] font-bold tracking-[.16em] uppercase" style={{ color: s.tint }}>Step 0{active + 1} of 0{steps.length} · {s.kicker}</span>
              <h3 className="mt-2 font-display text-[30px] font-semibold desk:text-[36px]">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--lp-fg)]">{s.body}</p>
              {s.cta ? (
                <a href={s.cta.href} className="group mt-4 inline-flex items-center gap-2 text-[14px] font-bold" style={{ color: s.tint }}>
                  {s.cta.label} <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </a>
              ) : null}
              <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.round(within * 100)}%`, background: s.colour }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
