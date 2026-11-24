import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Discussions" };

/** BLong › Discussions: opens in the next step of Phase 18. */
export default async function Page() {
  await requireMember("/blong/discussions");
  return (
    <EmptyState>
      <b className="mb-1 block text-[15px] text-fg">Opening soon</b>
      Rooms to talk one topic through open here next. You&apos;ll be able to start one, explore and join.{" "}
      Meanwhile, <Link href="/blong/networking" className="font-bold text-link">meet members in Networking</Link>.
    </EmptyState>
  );
}
