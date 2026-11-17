"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's loom: threads in the four space colours flow across the screen, cross over and under
 * each other and gather into one knot (the house). The pointer pulls the threads; a tap sends a ripple.
 * Pauses off screen; draws a single still frame for reduced motion.
 */
const COLOURS = ["#E39B2D", "#1F4FA3", "#B5532F", "#8DBF2E"];
const TEAL = "#29BE9C";

type Thread = { colour: string; group: number; seed: number; amp: number; speed: number; width: number; offset: number; pulse: number };

export function WeaveCanvas({ className, knot = { x: 0.68, y: 0.5 }, intensity = 1 }: { className?: string; knot?: { x: number; y: number }; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SEG = 72;
    let w = 0, h = 0, dpr = 1;
    let threads: Thread[] = [];
    // Pointer, smoothed, plus ripples from taps.
    const p = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0 };
    const ripples: { x: number; y: number; t: number }[] = [];

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const perGroup = w < 640 ? 5 : 8;
      threads = [];
      for (let g = 0; g < 4; g++)
        for (let i = 0; i < perGroup; i++)
          threads.push({
            colour: COLOURS[g],
            group: g,
            seed: g * 13.7 + i * 2.31,
            amp: (0.1 + 0.06 * Math.sin(i * 1.7 + g)) * h,
            speed: 0.18 + ((i * 7 + g * 3) % 5) * 0.035,
            width: i === 0 ? 2 : 0.6 + ((i * 5) % 3) * 0.35,
            offset: (i - perGroup / 2) * (h * 0.012) + (g - 1.5) * h * 0.09,
            pulse: (i * 0.137 + g * 0.29) % 1,
          });
    };

    // Each thread enters from the left in its own band, gathers at the knot, then fans out to the right.
    const point = (t: Thread, u: number, time: number) => {
      const kx = knot.x * w, ky = knot.y * h;
      const x = u * w;
      const toKnot = Math.exp(-Math.pow((x - kx) / (w * 0.16), 2)); // 1 at the knot
      const wave =
        Math.sin(u * 6.2 + time * t.speed + t.seed) * t.amp * 0.55 +
        Math.sin(u * 13.1 - time * t.speed * 1.6 + t.seed * 2.1) * t.amp * 0.18;
      const band = ky + t.offset * (1 + 2.2 * Math.abs(u - knot.x));
      let y = band + wave * (1 - 0.85 * toKnot);
      // Twist around the knot: groups braid over and under.
      y += Math.sin(time * 0.6 + t.group * (Math.PI / 2) + u * 18) * h * 0.03 * toKnot;
      let px = x;
      // Pointer pull: threads lean towards the pointer, softly.
      if (p.on > 0.01) {
        const dx = p.x - px, dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        const r = Math.max(w, h) * 0.16;
        const f = Math.exp(-d2 / (r * r)) * 0.55 * p.on * intensity;
        px += dx * f * 0.35;
        y += dy * f;
      }
      for (const rp of ripples) {
        const age = time - rp.t;
        const dx = px - rp.x, dy = y - rp.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const front = age * w * 0.45;
        const k = Math.exp(-Math.pow((d - front) / 40, 2)) * Math.max(0, 1 - age / 2.2);
        y += Math.sin(d * 0.05 - age * 10) * 22 * k;
      }
      return { x: px, y, depth: Math.sin(u * 18 + t.seed + time * 0.4) };
    };

    let raf = 0, visible = true, last = performance.now(), time = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      p.x += (p.tx - p.x) * 0.12;
      p.y += (p.ty - p.y) * 0.12;
      while (ripples.length && time - ripples[0].t > 2.2) ripples.shift();
      draw();
      if (visible && !still) raf = requestAnimationFrame(frame);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Faint warp threads: the loom.
      ctx.strokeStyle = "rgba(220,241,221,0.045)";
      ctx.lineWidth = 1;
      const step = w < 640 ? 28 : 36;
      for (let x = (time * 6) % step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      for (const t of threads) {
        const pts = Array.from({ length: SEG + 1 }, (_, i) => point(t, i / SEG, time));
        // Over and under: segments behind the weave are drawn dimmer.
        for (let i = 0; i < SEG; i++) {
          const a = pts[i], b = pts[i + 1];
          const front = a.depth > 0;
          ctx.strokeStyle = t.colour;
          ctx.globalAlpha = (front ? 0.85 : 0.28) * (t.width > 1.5 ? 1 : 0.7);
          ctx.lineWidth = front ? t.width : t.width * 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        // A light travelling along the main threads.
        if (t.width > 1.5 && !still) {
          const u = (time * 0.12 + t.pulse) % 1;
          const q = point(t, u, time);
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 18);
          g.addColorStop(0, t.colour);
          g.addColorStop(1, "transparent");
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // The knot: where the four spaces meet.
      const kx = knot.x * w, ky = knot.y * h;
      const glow = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.min(w, h) * 0.22);
      glow.addColorStop(0, "rgba(41,190,156,0.35)");
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.8 + 0.2 * Math.sin(time * 1.4);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = TEAL;
      ctx.beginPath();
      ctx.arc(kx, ky, 3.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      p.tx = e.clientX - r.left;
      p.ty = e.clientY - r.top;
      if (p.x < -999) { p.x = p.tx; p.y = p.ty; }
      p.on = 1;
    };
    const onLeave = () => { p.on = 0; };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: time });
    };

    build();
    if (still) draw();
    else raf = requestAnimationFrame(frame);
    const host = canvas.parentElement ?? canvas;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);
    const ro = new ResizeObserver(() => { build(); if (still) draw(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !still) { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); }
    });
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, [knot.x, knot.y, intensity]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
