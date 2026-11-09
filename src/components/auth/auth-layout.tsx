import Image from "next/image";
import Link from "next/link";

/** Split screen for sign-in and sign-up: photo on the left from 900px up, form on the right. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh desk:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink desk:block">
        <Image src="/images/stage.jpg" alt="" fill priority sizes="50vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute inset-x-10 bottom-10 flex flex-col gap-3 text-white">
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={200} height={14} />
          <p className="max-w-[420px] font-display text-[26px] leading-tight font-semibold">
            Experience, knowledge and access to MENA&apos;s venture ecosystem.
          </p>
          <p className="text-[13.5px] text-ink-fg">Outloud · The Venture School · BRICKR · QuidQuo</p>
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center bg-bg px-4 py-10">
        <Link href="/" className="mb-8 desk:hidden">
          <Image src="/brand/logo-on-light.svg" alt="VentureWeavers" width={190} height={14} className="dark:invert" />
        </Link>
        <div className="flex w-full max-w-[380px] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
