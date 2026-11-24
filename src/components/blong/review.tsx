import Link from "next/link";
import { Clock, XCircle } from "lucide-react";
import { NotifyButton } from "@/components/waitlist/notify-button";
import { BLONG_SECTION_IDS, type BlongSection } from "@/lib/blong/format";
import { myWaitlist } from "@/lib/waitlist-server";
import { waitKey } from "@/lib/waitlist";

/** For the creator of a community or discussion waiting for (or refused) approval. */
export function ReviewBanner({ kind, status, note, resubmitted, editHref }: {
  kind: "community" | "discussion"; status: string; note?: string | null; resubmitted?: boolean; editHref: string | null;
}) {
  if (status === "pending") {
    return (
      <div className="bl-review warn flex items-start gap-3 rounded-2xl border px-4 py-3">
        <Clock size={18} className="mt-0.5 flex-none" aria-hidden="true" />
        <div className="text-[13.5px]">
          <b className="block">Waiting for approval</b>
          The VentureWeavers team reviews every new {kind} before members can find it. You&apos;ll get a notification once it&apos;s live.
          {editHref ? <> You can still <Link href={editHref} scroll={false} className="font-bold text-link">edit it</Link>.</> : null}
        </div>
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="bl-review bad flex items-start gap-3 rounded-2xl border px-4 py-3">
        <XCircle size={18} className="mt-0.5 flex-none" aria-hidden="true" />
        <div className="text-[13.5px]">
          <b className="block">Not approved</b>
          {note ? <span className="block whitespace-pre-line">The team&apos;s note: {note}</span> : null}
          {!resubmitted && editHref
            ? <>Make the changes and save to send it for review again. <Link href={editHref} scroll={false} className="font-bold text-link">Edit and resubmit</Link></>
            : <>It can&apos;t be sent for review again. You can delete it, or message the team.</>}
        </div>
      </div>
    );
  }
  return null;
}

const SOON: Record<BlongSection, { title: string; line: string }> = {
  communities: { title: "Communities are coming soon", line: "Groups around an industry, a role, a city or a program. We'll tell you the moment they open." },
  discussions: { title: "Discussions are coming soon", line: "Live rooms to talk one topic through with founders, investors and experts. We'll tell you when they open." },
};

/** Shown in place of a BLong section the team has switched off. */
export async function SectionSoon({ section }: { section: BlongSection }) {
  const id = BLONG_SECTION_IDS[section];
  const on = (await myWaitlist()).has(waitKey("blong_section", id));
  return (
    <div className="bl flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-line2 px-5 py-12 text-center">
      <span className="bl-chip soft">Coming soon</span>
      <h2 className="font-display text-[24px] leading-tight font-semibold">{SOON[section].title}</h2>
      <p className="max-w-[460px] text-[14px] text-faint">{SOON[section].line}</p>
      <NotifyButton type="blong_section" id={id} on={on} signedIn size="md" variant="primary" className="bl-follow mt-1" />
      <Link href="/blong/networking" scroll={false} className="text-[13px] font-bold text-link">Meanwhile, meet members in Networking</Link>
    </div>
  );
}
