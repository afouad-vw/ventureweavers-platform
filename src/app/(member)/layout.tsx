export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { MemberShell } from "@/components/shell/shells";
import { initialsOf } from "@/lib/initials";
import { getMember } from "@/lib/auth/guards";
import { myLiveShows } from "@/lib/live/queries";
import { myNotifications } from "@/lib/notifications/queries";

/** Member pages are for signed-in members only; keep them out of search engines. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const m = await getMember();
  const name = m?.name || m?.email || "Member";
  const [liveShows, notifications] = m ? await Promise.all([myLiveShows().catch(() => []), myNotifications().catch(() => [])]) : [[], []];
  const live = liveShows.length > 0;
  return (
    <MemberShell live={live} notifications={notifications} member={m ? { name, initials: initialsOf(name), sub: "My space" } : null}>
      {children}
    </MemberShell>
  );
}
