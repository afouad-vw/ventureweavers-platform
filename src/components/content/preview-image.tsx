"use client";

import { useEffect, useRef, useState } from "react";

/** A post preview that removes itself if the image can't load (expired links), showing the cover behind it. */
export function PreviewImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // The image may fail before the page is interactive; check once it is.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the post's own preview, cropped to fit
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
    />
  );
}
