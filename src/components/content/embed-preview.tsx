"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { embedFor } from "@/lib/content/embed";

/**
 * The reel's real preview from the platform, scaled to fill the tile (the platform header is cropped off).
 * Not clickable itself: the tile's link opens the post.
 */
export function EmbedPreview({ url, title }: { url: string; title: string }) {
  const e = useMemo(() => embedFor(url), [url]);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el || !e) return;
    const fit = () => setScale(el.clientWidth / e.width);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [e]);
  if (!e) return null;
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
      {scale ? (
        <iframe
          src={e.src}
          title={`Preview of ${title}`}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
          style={{ width: e.width, height: e.height, transform: `scale(${scale}) translateY(-${e.offset}px)` }}
        />
      ) : null}
    </div>
  );
}
