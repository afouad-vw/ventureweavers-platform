"use client";

import { useEffect, useRef } from "react";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Calls `onChange` whenever the show's live session changes (Supabase Realtime), and every
 * `fallbackMs` as a backup. Calls are spaced at least 800 ms apart so a burst of votes is one refresh.
 */
export function useLiveUpdates(eventId: string | null, onChange: () => void, fallbackMs = 10_000) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!eventId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    const fire = () => {
      if (timer) return;
      const wait = Math.max(0, 800 - (Date.now() - last));
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        cb.current();
      }, wait);
    };
    let channel: ReturnType<ReturnType<typeof browserClient>["channel"]> | null = null;
    try {
      const sb = browserClient();
      channel = sb
        .channel(`live:${eventId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `event_id=eq.${eventId}` }, fire)
        .subscribe();
    } catch {
      // Realtime unavailable: the interval below still keeps the page fresh.
    }
    const interval = setInterval(() => document.visibilityState === "visible" && fire(), fallbackMs);
    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void browserClient().removeChannel(channel);
    };
  }, [eventId, fallbackMs]);
}
