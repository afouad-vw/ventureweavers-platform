/** Notifications bell: shared types and small helpers. */

export type Notice = { id: string; text: string; href: string; created_at: string; read_at: string | null };
export const SHOWN = 20;

export const unreadCount = (items: Pick<Notice, "read_at">[]) => items.filter((n) => !n.read_at).length;

/** Badge text: the number, capped at 9+. Empty when nothing is unread. */
export function badgeText(n: number) {
  return n <= 0 ? "" : n > 9 ? "9+" : String(n);
}

/** Only links inside the member app are followed. */
export function safeHref(href: string) {
  return /^\/(?!\/)[A-Za-z0-9/_?=&%.-]*$/.test(href) ? href : "/my-space";
}
