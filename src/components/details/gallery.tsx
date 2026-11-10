"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Show photos: a grid that opens full screen. Arrow keys, swipe and Escape work. */
export function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const startX = useRef<number | null>(null);
  const go = useCallback((by: number) => setOpen((i) => (i === null ? i : (i + by + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go]);

  if (!photos.length) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((src, i) => (
          <button key={src} type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/50 bg-hover shadow-depth-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- public photos uploaded by the hosts */}
            <img src={src} alt={`${title}, photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
          </button>
        ))}
      </div>
      {open !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photos`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/85 backdrop-blur-md"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (startX.current === null) return;
            const dx = e.changedTouches[0].clientX - startX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            startX.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- full-screen view */}
          <img src={photos[open]} alt={`${title}, photo ${open + 1}`} className="max-h-[86dvh] max-w-[92vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-bold text-white">{open + 1} / {photos.length}</span>
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="absolute top-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X size={20} aria-hidden="true" /></button>
          {photos.length > 1 ? (
            <>
              <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={22} aria-hidden="true" /></button>
              <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight size={22} aria-hidden="true" /></button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
