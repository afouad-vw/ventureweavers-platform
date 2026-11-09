export const dynamic = "force-dynamic";

import { initialsOf, MemberShell } from "@/components/shell/shells";
import { getMember } from "@/lib/auth/guards";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const m = await getMember();
  const name = m?.name || m?.email || "Member";
  return (
    <MemberShell member={m ? { name, initials: initialsOf(name), sub: "My space" } : null}>
      {children}
    </MemberShell>
  );
}
