import type { Metadata } from "next";
import Image from "next/image";
import { AdminSignInForm } from "./form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

/** Admin console login. Separate from member sign-in; no link to it from the member app. */
export default function AdminSignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={200} height={14} priority />
          <span className="text-[11px] font-extrabold tracking-[1.4px] text-teal uppercase">Admin console</span>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-[0_20px_60px_rgb(0_0_0/0.35)]">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-xl font-semibold">Sign in</h1>
            <p className="text-[13.5px] text-muted">For the VentureWeavers team only.</p>
          </div>
          <AdminSignInForm />
        </div>
      </div>
    </main>
  );
}
