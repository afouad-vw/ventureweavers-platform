"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { LivePill } from "@/components/live/live-room";
import { useLiveUpdates } from "@/components/live/use-live";
import { momentLabel, pollPercents } from "@/lib/live/format";

type Props = {
  eventId: string | null;
  title: string;
  open: boolean;
  moment: number;
  picked: { text: string; who: string } | null;
  poll: { question: string; options: { id: string; label: string; votes: number }[] } | null;
};

/** What the venue screen shows: the moment, the picked question and the open poll. Updates on its own. */
export function ScreenView({ eventId, title, open, moment, picked, poll }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useLiveUpdates(eventId, refresh, 5_000);
  const pct = pollPercents(poll?.options.map((o) => o.votes) ?? []);
  const total = poll?.options.reduce((n, o) => n + o.votes, 0) ?? 0;
  return (
    <div className="flex min-h-dvh flex-col gap-[4vh] p-[5vw]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={240} height={18} priority />
        <div className="flex items-center gap-3">
          {open ? <LivePill /> : null}
          <b className="font-display text-[clamp(16px,1.6vw,28px)] text-white">{title}</b>
        </div>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-[3vh]">
        <span className="text-[clamp(14px,1.4vw,24px)] font-extrabold tracking-[2px] text-teal uppercase">{open ? momentLabel(moment) : "Open Floor"}</span>
        <p className="font-display text-[clamp(28px,4.4vw,84px)] leading-[1.15] font-semibold text-white">
          {picked ? `“${picked.text}”` : open ? "Ask your question from your phone: My space › Live mode." : "Live mode opens soon."}
        </p>
        {picked ? <span className="text-[clamp(16px,1.6vw,28px)] text-ink-muted">Asked by {picked.who}</span> : null}
      </main>
      {poll ? (
        <section className="flex flex-col gap-[1.6vh] rounded-2xl bg-ink2 p-[2.4vw]" aria-label="Poll results">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[clamp(18px,2vw,36px)] font-semibold text-white">{poll.question}</h2>
            <span className="text-[clamp(13px,1.2vw,22px)] text-ink-muted">{total} {total === 1 ? "vote" : "votes"}</span>
          </div>
          {poll.options.map((o, i) => (
            <div key={o.id} className="flex flex-col gap-1">
              <span className="flex justify-between gap-4 text-[clamp(15px,1.5vw,28px)] font-bold text-white"><span>{o.label}</span><span className="font-display">{pct[i]}%</span></span>
              <span className="h-[1.4vh] min-h-2 overflow-hidden rounded-full bg-ink" aria-hidden="true"><span className="block h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${pct[i]}%` }} /></span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
