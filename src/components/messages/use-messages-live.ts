"use client";

import { useEffect, useRef } from "react";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Calls `onChange` when a message arrives (Supabase Realtime, limited by row level security to what
 * this person may read) and every `fallbackMs` as a backup. `threadId` "all" listens to every thread.
 */
export function useMessagesLive(threadId: string | null, onChange: () => void, fallbackMs = 10_000) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        cb.current();
      }, 300);
    };
    let channel: ReturnType<ReturnType<typeof browserClient>["channel"]> | null = null;
    if (threadId) {
      try {
        channel = browserClient()
          .channel(`messages:${threadId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", ...(threadId === "all" ? {} : { filter: `thread_id=eq.${threadId}` }) }, fire)
          .subscribe();
      } catch {
        // Realtime unavailable: the interval below keeps the conversation fresh.
      }
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
  }, [threadId, fallbackMs]);
}
