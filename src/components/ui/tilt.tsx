"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Gentle 3D tilt toward the cursor with a light sheen. Mouse only (no tilt on touch),
 * and off for people who ask for reduced motion (see .vw-tilt in globals.css).
 */
export function Tilt({ className, max = 5, children }: { className?: string; max?: number; children: React.ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const reset = () => {
    const n = el.current;
    if (!n) return;
    n.dataset.active = "false";
    n.style.setProperty("--rx", "0deg");
    n.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      ref={el}
      className={cn("vw-tilt group relative", className)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const n = el.current;
        if (!n) return;
        const r = n.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          n.dataset.active = "true";
          n.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
          n.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
          n.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
          n.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
        });
      }}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {children}
      <span className="vw-sheen" aria-hidden="true" />
    </div>
  );
}
