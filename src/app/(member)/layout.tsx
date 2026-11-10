export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { needsAbout } from "@/lib/profile/about";
import { createClient } from "@/lib/supabase/server";
import { MemberShell } from "@/components/shell/shells";
import { initialsOf } from "@/lib/initials";
import { getMember } from "@/lib/auth/guards";
import { myLiveShows } from "@/lib/live/queries";
import { myNotifications } from "@/lib/notifications/queries";

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
  const [liveShows, notifications] = m ? await Promise.all([myLiveShows().catch(() => []), myNotifications().catch(() => [])]) : [[], []];
  const live = liveShows.length > 0;
  return (
    <MemberShell live={live} notifications={notifications} member={m ? { name, initials: initialsOf(name), sub: "My space", avatar: m.avatar } : null}>
      {children}
    </MemberShell>
  );
}
