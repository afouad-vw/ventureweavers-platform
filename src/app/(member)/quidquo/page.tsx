import type { Metadata } from "next";
import { WeaveHero } from "@/components/ui/weave";
import { CopyInviteButton, JoinedMark, LeaveWaitlistButton, WaitlistForm } from "@/components/brickr/brickr-client";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { getMember } from "@/lib/auth/guards";
import { myWaitlist, qqLog, qqStages } from "@/lib/brickr/queries";
import { formatDate } from "@/lib/events/format";

export const metadata: Metadata = { title: "QuidQuo" };

export default async function QuidQuoPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const refCode = ref && /^[2-9A-Z]{8}$/.test(ref) ? ref : null;
  const member = await getMember();
  const [stages, log, mine] = await Promise.all([qqStages(), qqLog(), member ? myWaitlist(member.id) : null]);
  const nowIdx = stages.findIndex((s) => s.progress < 100);

  return (
    <>
      <WeaveHero
        id="quidquo-weave"
        above={<ThreadTag thread="QuidQuo" label="QuidQuo · building now" />}
        title="QuidQuo"
        description="AI for raising capital, built in the open. Follow every stage and be first in when it opens."
        actions={mine ? <StatusPill tone="ok">On the waitlist</StatusPill> : undefined}
      />
      <Card>
        <CardHeader title="Where we are" action={stages.length ? <span className="font-normal text-faint">Stage {Math.max(1, (nowIdx < 0 ? stages.length - 1 : nowIdx) + 1)} of {stages.length}</span> : null} />
        {stages.length ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            {stages.map((s, i) => (
              <div key={s.id} className={cn("flex flex-col gap-1.5 rounded-xl border p-3", i === nowIdx ? "border-qq bg-qq-bg" : "border-line")}>
                <div className="h-1.5 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full bg-qq" style={{ width: `${s.progress}%` }} /></div>
                <span className={cn("text-[11px] font-extrabold tracking-[1.2px] uppercase", s.progress ? "text-qq-fg" : "text-faint")}>
                  Stage {i + 1} · {s.progress >= 100 ? "Done" : i === nowIdx ? "Now" : "Next"}
                </span>
                <b className="text-[14px]">{s.name}</b>
                <span className="text-[13px] text-faint">{s.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-faint">Stages are on the way.</span>
        )}
      </Card>
      <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]">
        <Card>
          <CardHeader title="Build log" />
          {log.length ? (
            <ul className="flex flex-col">
              {log.map((l) => (
                <li key={l.id} className="flex items-start gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="w-[84px] shrink-0 text-[12.5px] font-bold text-faint">{formatDate(l.entry_date + "T12:00:00Z")}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold">{l.title}</div>
                    {l.body ? <span className="text-[13.5px] text-muted">{l.body}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>The first entries are coming soon.</EmptyState>
          )}
        </Card>
        <aside className="flex min-w-0 flex-col gap-4">
          {mine ? (
            <Card>
              <JoinedMark />
              <h2 className="text-[15px] font-extrabold">You&apos;re on the list</h2>
              <span className="text-[13px] text-muted">Joined as {mine.role.toLowerCase()}{member?.email ? ` with ${member.email}` : ""}. We&apos;ll message you before each stage opens.</span>
              <CopyInviteButton code={mine.invite_code} />
              <details className="text-[13px]">
                <summary className="cursor-pointer font-bold text-link">Change my details</summary>
                <div className="mt-2">
                  <WaitlistForm signedIn refCode={null} current={mine} />
                </div>
              </details>
              <LeaveWaitlistButton />
            </Card>
          ) : (
            <Card>
              <h2 className="text-[15px] font-extrabold">Be first to join</h2>
              {refCode ? <span className="text-[12.5px] text-faint">You were invited by a member.</span> : null}
              <WaitlistForm signedIn={!!member} refCode={refCode} current={null} />
            </Card>
          )}
          <Card className="border-transparent bg-qq-bg">
            <h2 className="text-[15px] font-extrabold">Shape what we build</h2>
            <span className="text-[13px]">Waitlist members join short feedback calls and try features first.</span>
          </Card>
        </aside>
      </div>
    </>
  );
}
