import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home/dashboard";
import { NotificationsList } from "@/components/shell/notifications-list";
import { isSpace } from "@/lib/content/format";
import { myNotifications } from "@/lib/notifications/queries";

export const metadata: Metadata = { title: "Updates & Notifications" };

/** Updates & Notifications: the member's notifications, then what's next for them and the feed. */
export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const { space: raw } = await searchParams;
  const notices = await myNotifications().catch(() => []);
  return (
    <>
      <NotificationsList initial={notices} />
      <HomeDashboard space={raw && isSpace(raw) ? raw : "All"} base="/updates" />
    </>
  );
}
