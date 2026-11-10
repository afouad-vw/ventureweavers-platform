export const dynamic = "force-dynamic";

import { MemberShell } from "@/components/shell/shells";
import { initialsOf } from "@/lib/initials";
import { getMember } from "@/lib/auth/guards";
import { myLiveShows } from "@/lib/live/queries";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const m = await getMember();
  const name = m?.name || m?.email || "Member";
  const live = m ? (await myLiveShows().catch(() => [])).length > 0 : false;
  return (
    <MemberShell live={live} member={m ? { name, initials: initialsOf(name), sub: "My space" } : null}>
      {children}
    </MemberShell>
  );
}
