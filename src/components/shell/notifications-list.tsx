"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import { safeHref, unreadCount, type Notice } from "@/lib/notifications/format";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(member)/notification-actions";

/** The member's notifications as a full list (Updates & Notifications screen). */
export function NotificationsList({ initial }: { initial: Notice[] }) {
  const [items, setItems] = useState(initial);
  const router = useRouter();
  const unread = unreadCount(items);
  const go = (n: Notice) => {
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      void markNotificationRead(n.id);
    }
    router.push(safeHref(n.href));
  };
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-card p-4 shadow-depth">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
          <Bell size={16} aria-hidden="true" className="text-teal" />
          Notifications
          {unread ? <span className="rounded-full bg-teal px-2 text-[11px] leading-[18px] font-extrabold text-ink">{unread} new</span> : null}
        </h2>
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
        <ul className="flex max-h-[340px] flex-col overflow-y-auto">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => go(n)} className={cn("flex w-full cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-hover", !n.read_at && "bg-soft")}>
                <i className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-teal")} aria-hidden="true" />
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
        <p className="px-1 py-4 text-[13px] text-faint">Nothing yet. Bookings, offers, meetings and payments show up here.</p>
      )}
    </section>
  );
}
