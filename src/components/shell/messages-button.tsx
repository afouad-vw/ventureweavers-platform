"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { fetchUnreadMessages } from "@/app/(member)/messages/actions";
import { badgeText } from "@/lib/notifications/format";

/** Member top bar: opens the conversation with the team; shows unread replies. Refreshes every 60 seconds. */
export function MessagesButton({ initial }: { initial: number }) {
  const [unread, setUnread] = useState(initial);
  const path = usePathname();
  const onPage = path === "/messages";

  const refresh = useCallback(async () => {
    const n = await fetchUnreadMessages().catch(() => null);
    if (n !== null) setUnread(n);
  }, []);

  useEffect(() => {
    if (onPage) setUnread(0);
    else void refresh();
  }, [onPage, refresh]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && !onPage && refresh(), 60_000);
    return () => clearInterval(t);
  }, [onPage, refresh]);

  return (
    <Link
      href="/messages"
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      aria-current={onPage ? "page" : undefined}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line2/70 bg-card/70 text-fg backdrop-blur-md transition-[background-color,box-shadow] hover:bg-card hover:shadow-depth"
    >
      <MessageSquare size={18} aria-hidden="true" />
      {unread ? <span className="absolute -top-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-card bg-teal px-1 text-[10px] font-extrabold text-ink">{badgeText(unread)}</span> : null}
    </Link>
  );
}
