"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import { badgeText, safeHref, unreadCount, type Notice } from "@/lib/notifications/format";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/(member)/notification-actions";

/** Member top bar: bell with unread count and a panel of the latest notifications. Refreshes every 60 seconds. */
export function NotificationsBell({ initial }: { initial: Notice[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const unread = unreadCount(items);

  const refresh = useCallback(async () => {
    const next = await fetchNotifications().catch(() => null);
    if (next) setItems(next);
  }, []);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (n: Notice) => {
    setOpen(false);
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      void markNotificationRead(n.id);
    }
    router.push(safeHref(n.href));
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void refresh();
        }}
        className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line2/70 bg-card/70 text-fg backdrop-blur-md transition-[background-color,box-shadow] hover:bg-card hover:shadow-depth"
      >
        <Bell size={18} aria-hidden="true" />
        {unread ? <span className="absolute -top-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-card bg-teal px-1 text-[10px] font-extrabold text-ink">{badgeText(unread)}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Notifications" className="glass-strong fixed inset-x-3 top-[60px] z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-[360px]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
            <b className="text-[14px]">Notifications</b>
            {unread ? (
              <button
                type="button"
                onClick={() => {
                  const now = new Date().toISOString();
                  setItems((list) => list.map((x) => (x.read_at ? x : { ...x, read_at: now })));
                  void markAllNotificationsRead();
                }}
                className="min-h-9 cursor-pointer px-1 text-[12.5px] font-bold text-link hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length ? (
            <ul className="flex flex-col overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => go(n)} className={cn("flex w-full cursor-pointer gap-2.5 border-b border-line px-3.5 py-3 text-left last:border-b-0 hover:bg-hover", !n.read_at && "bg-soft")}>
                    <i className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[13.5px] leading-snug", !n.read_at && "font-bold")}>{n.text}</span>
                      <span className="text-[12px] text-faint">{relativeWhen(n.created_at)}</span>
                    </span>
                    {!n.read_at ? <span className="sr-only">Unread</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3.5 py-6 text-center text-[13px] text-faint">Nothing yet. Bookings, offers, meetings and payments show up here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
