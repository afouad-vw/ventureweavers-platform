import Image from "next/image";

/** Dark full-screen frame for admin sign-in and first-time password screens. */
export function GateFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={200} height={14} priority />
          <span className="text-[11px] font-extrabold tracking-[1.4px] text-teal uppercase">Admin console</span>
        </div>
        <div className="glass-strong flex flex-col gap-4 rounded-[24px] border p-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-xl font-semibold">{title}</h1>
            <p className="text-[13.5px] text-muted">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
