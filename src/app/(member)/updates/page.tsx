import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home/dashboard";
import { NotificationsList } from "@/components/shell/notifications-list";
import { LinkTabs } from "@/components/ui/link-tabs";
import { isSpace } from "@/lib/content/format";
import { unreadCount } from "@/lib/notifications/format";
import { myNotifications } from "@/lib/notifications/queries";

export const metadata: Metadata = { title: "Updates & Notifications" };

/** Updates & Notifications: two tabs, what's new for the member (home dashboard) and their notifications. */
export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ space?: string; tab?: string }> }) {
  const { space: raw, tab } = await searchParams;
  const notices = await myNotifications().catch(() => []);
  const unread = unreadCount(notices);
  const view = tab === "notifications" ? "notifications" : "updates";
  return (
    <>
      <LinkTabs
        label="Updates and notifications"
        value={view}
        hrefFor={(v) => (v === "updates" ? "/updates" : "/updates?tab=notifications")}
        items={[
          { value: "updates", label: "Updates" },
          { value: "notifications", label: "Notifications", count: unread || null },
        ]}
      />
      {view === "notifications" ? <NotificationsList initial={notices} /> : <HomeDashboard space={raw && isSpace(raw) ? raw : "All"} base="/updates" />}
    </>
  );
}
