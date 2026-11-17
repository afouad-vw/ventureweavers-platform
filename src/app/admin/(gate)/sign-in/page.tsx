import type { Metadata } from "next";
import Link from "next/link";
import { FormNote } from "@/components/auth/form-note";
import { currentAdminBase } from "@/lib/auth/guards";
import { adminHref } from "@/lib/hosts";
import { GateFrame } from "../gate-layout";
import { AdminSignInForm } from "./form";

export const metadata: Metadata = { title: "Admin sign in" };

/** Admin console login. Separate from member sign-in; no link to it from the member app. */
export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ expired?: string; error?: string }> }) {
  const { expired, error } = await searchParams;
  const forgot = adminHref("/admin/forgot-password", await currentAdminBase());
  return (
    <GateFrame title="Sign in" description="For the VentureWeavers team only.">
      {expired ? <FormNote state={{ message: "You were signed out after a period without activity." }} /> : null}
      {error === "link" ? <FormNote state={{ error: "That link has expired or was already used. Use Forgot password to get a new one." }} /> : null}
      <AdminSignInForm />
      <Link href={forgot} className="self-center text-[13.5px] font-bold text-link hover:underline">Forgot password?</Link>
    </GateFrame>
  );
}
