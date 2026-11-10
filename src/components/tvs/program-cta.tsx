import Link from "next/link";
import { ApplyButton, DatesButton, NotifyButton } from "@/components/tvs/program-buttons";
import { LinkButton } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/tag";
import { applicationLabel, programCardState, type EnrolmentStatus } from "@/lib/tvs/format";
import type { myTvs, Program } from "@/lib/tvs/queries";

export type TvsMine = Awaited<ReturnType<typeof myTvs>>;

/** What the member can do next with a program: apply, see their application, pay, open the classroom, or be notified. */
export function ProgramCta({
  p,
  mine,
  signedIn,
  profile,
  size = "sm",
}: {
  p: Program;
  mine: TvsMine;
  signedIn: boolean;
  profile: { role?: string | null; stage?: string | null } | null;
  size?: "sm" | "md";
}) {
  const enrolledPrograms = new Map<string, EnrolmentStatus>();
  for (const e of mine.enrolments) {
    const pid = e.cohorts?.program_id;
    if (pid && e.status !== "cancelled" && enrolledPrograms.get(pid) !== "confirmed") enrolledPrograms.set(pid, e.status);
  }
  const st = programCardState(p, { applications: mine.applications, enrolledPrograms, interests: mine.interests });
  if (st.kind === "apply") return <ApplyButton programId={p.id} programName={p.name} signedIn={signedIn} defaults={{ role: profile?.role, stage: profile?.stage }} />;
  if (st.kind === "applied") return <Link href="/my-space?tab=learning"><StatusPill tone="blue">Applied · {applicationLabel(st.status)}</StatusPill></Link>;
  if (st.kind === "offered") return <LinkButton href="/my-space?tab=learning" size={size}>Confirm your seat</LinkButton>;
  if (st.kind === "enrolled") return <LinkButton href="/tvs/classroom" size={size}>Open classroom</LinkButton>;
  if (st.kind === "notify") return <NotifyButton programId={p.id} on={st.on} signedIn={signedIn} />;
  return <DatesButton name={p.name} />;
}
