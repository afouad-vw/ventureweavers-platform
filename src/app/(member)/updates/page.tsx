import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home/dashboard";
import { NotificationsList } from "@/components/shell/notifications-list";
import { isSpace } from "@/lib/content/format";
import { myNotifications } from "@/lib/notifications/queries";

export const metadata: Metadata = { title: "Home" };

/** Home (the member's dashboard) and, with ?tab=notifications, their notifications. Each has its own top-bar icon. */
export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ space?: string; tab?: string }> }) {
  const { space: raw, tab } = await searchParams;
  if (tab === "notifications") {
    const notices = await myNotifications().catch(() => []);
    return <NotificationsList initial={notices} />;
  }
  return <HomeDashboard space={raw && isSpace(raw) ? raw : "All"} base="/updates" />;
}
