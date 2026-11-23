export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { needsAbout } from "@/lib/profile/about";
import { createClient } from "@/lib/supabase/server";
import { MemberShell } from "@/components/shell/shells";
import { HouseShell } from "@/components/house/house-shell";
import { HOUSE_COOKIE, isHouseLook } from "@/lib/house";
import { sharpAvatar } from "@/lib/avatar";
import { initialsOf } from "@/lib/initials";
import { getMember } from "@/lib/auth/guards";
import { myLiveShows } from "@/lib/live/queries";
import { myNotifications } from "@/lib/notifications/queries";
import { myUnreadMessages } from "@/lib/messages/queries";

/** Member pages are for signed-in members only; keep them out of search engines. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const m = await getMember();
  // A suspended account is signed out and told why.
  if (m?.suspended) redirect("/auth/suspended");
  if (m) {
    // New members, and existing ones missing the new details, complete "About you" once.
    const supabase = await createClient();
    const { data: p } = await supabase.from("profiles").select("full_name, phone, country, role, goals, contact_prefs").eq("id", m.id).maybeSingle();
    if (needsAbout(p)) {
      const path = (await headers()).get("x-vw-path") || "/";
      redirect(`/welcome?next=${encodeURIComponent(path)}`);
    }
  }
  const name = m?.name || m?.email || "Member";
  const [liveShows, notifications, unreadMessages] = m
    ? await Promise.all([myLiveShows().catch(() => []), myNotifications().catch(() => []), myUnreadMessages().catch(() => 0)])
    : [[], [], 0];
  const live = liveShows.length > 0;
  // The one-screen "house" look (the classic sidebar look only for browsers that chose it at /new-look?off=1).
  if (isHouseLook((await cookies()).get(HOUSE_COOKIE)?.value)) {
    return (
      <HouseShell live={live} notifications={notifications} unreadMessages={unreadMessages} member={m ? { name, firstName: name.split(/[\s@]/)[0] || name, initials: initialsOf(name), avatar: sharpAvatar(m.avatar) } : null}>
        {children}
      </HouseShell>
    );
  }
  return (
    <MemberShell live={live} notifications={notifications} unreadMessages={unreadMessages} member={m ? { name, initials: initialsOf(name), sub: "My space", avatar: m.avatar } : null}>
      {children}
    </MemberShell>
  );
}
