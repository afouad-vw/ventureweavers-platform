"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signInWithGoogleToken } from "@/app/(auth)/actions";
import type { FormState } from "@/lib/auth/form-state";
import { FormNote } from "./form-note";

type GoogleId = {
  initialize(o: Record<string, unknown>): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SRC = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("gis"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Google's own sign-in button. The popup runs on our domain, so Google names VentureWeavers
 * (or our address until Google approves the branding) instead of the Supabase project address.
 * Falls back to `fallback` (the redirect button) if Google's script can't load.
 */
export function GoogleButton({ clientId, verb, next, fallback }: { clientId: string; verb: "Sign in" | "Sign up"; next?: string; fallback: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await loadGis();
        const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
        const hashed = await sha256Hex(raw);
        if (!live || !box.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashed,
          ux_mode: "popup",
          context: verb === "Sign in" ? "signin" : "signup",
          itp_support: true,
          callback: (r: { credential?: string }) =>
            start(async () => {
              setState(null);
              const res = await signInWithGoogleToken({ credential: r.credential, nonce: raw, next });
              if (res) setState(res);
            }),
        });
        box.current.innerHTML = "";
        // Google's white button, always in English like the rest of the page.
        window.google.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          locale: "en",
          size: "large",
          shape: "rectangular",
          text: verb === "Sign in" ? "continue_with" : "signup_with",
          logo_alignment: "center",
          width: Math.min(400, Math.max(200, Math.round(box.current.clientWidth))),
        });
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [clientId, verb, next]);

  if (failed) return <>{fallback}</>;
  return (
    <div className="flex flex-col gap-1.5">
      {/* color-scheme: light stops the browser painting an opaque white box behind Google's frame on dark pages. */}
      <div ref={box} aria-busy={pending} style={{ colorScheme: "light" }} className={`flex min-h-11 w-full justify-center ${pending ? "pointer-events-none opacity-60" : ""}`} />
      <FormNote state={state} />
    </div>
  );
}
