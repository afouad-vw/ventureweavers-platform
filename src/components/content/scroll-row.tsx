"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** A row of cards that scrolls sideways (swipe, trackpad or the arrow buttons). The page itself never scrolls sideways. */
export function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = box.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.85), behavior: reduce ? "auto" : "smooth" });
  };

  const btn =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line2 bg-card/90 text-fg shadow-depth backdrop-blur-md transition-opacity hover:bg-card disabled:pointer-events-none disabled:opacity-0 sm:inline-flex";

  return (
    <div className="relative">
      <button type="button" className={`${btn} -left-3`} onClick={() => go(-1)} disabled={edges.start} aria-label={`Scroll ${label} left`}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div
        ref={box}
        onScroll={measure}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-primary motion-reduce:scroll-auto"
      >
        {children}
      </div>
      <button type="button" className={`${btn} -right-3`} onClick={() => go(1)} disabled={edges.end} aria-label={`Scroll ${label} right`}>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
