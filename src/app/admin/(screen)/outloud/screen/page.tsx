import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { adminLive } from "@/lib/live/queries";
import { ScreenView } from "./screen-view";

export const metadata: Metadata = { title: "Screen" };

export default async function ScreenPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  await requireAdmin();
  const { event } = await searchParams;
  const data = await adminLive(event);
  const picked = data.questions.find((q) => q.id === data.session?.picked_question);
  const poll = data.polls.find((p) => p.is_open) ?? null;
  return (
    <ScreenView
      eventId={data.event?.id ?? null}
      title={data.event?.title ?? "Open Floor"}
      open={Boolean(data.session?.is_open)}
      moment={data.session?.moment ?? 1}
      // The room sees "Anonymous" for anonymous questions, never the name.
      picked={picked ? { text: picked.text, who: picked.anonymous ? "Anonymous" : picked.who.split(" ")[0] } : null}
      poll={poll ? { question: poll.question, options: poll.options } : null}
    />
  );
}
