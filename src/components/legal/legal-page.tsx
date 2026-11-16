import Image from "next/image";
import Link from "next/link";
import { Markdown } from "@/components/content/markdown";
import { LEGAL_UPDATED } from "@/lib/legal/text";

/** Public page for the privacy policy and terms: open without signing in, no member shell. */
export function LegalPage({ title, source, other }: { title: string; source: string; other: { href: string; label: string } }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="VentureWeavers">
            <Image src="/brand/logo-on-light.svg" alt="VentureWeavers" width={170} height={12} className="dark:invert" />
          </Link>
          <Link href={other.href} className="text-[13px] font-bold text-link hover:underline">{other.label}</Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-2 px-4 py-8 desk:py-12">
        <h1 className="font-display text-[28px] font-semibold desk:text-[32px]">{title}</h1>
        <p className="text-[13px] text-faint">Last updated {LEGAL_UPDATED}</p>
        <Markdown source={source} className="mt-4 flex flex-col gap-3.5 text-[14.5px] leading-[1.7]" />
      </main>
    </div>
  );
}
