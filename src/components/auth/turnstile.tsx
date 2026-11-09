"use client";

import { useEffect, useRef } from "react";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile bot check. Adds a hidden `cf-turnstile-response` field to the form.
 * Tokens work once, so pass a new `resetKey` (e.g. the last form result) to get a fresh one.
 * Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function Turnstile({ resetKey }: { resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile || id.current) return;
        id.current = window.turnstile.render(box.current, { sitekey: siteKey, theme: "auto", size: "flexible" });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey !== undefined && id.current && window.turnstile) window.turnstile.reset(id.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
