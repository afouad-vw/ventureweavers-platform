import type { Metadata } from "next";
import { FormNote } from "@/components/auth/form-note";
import { GateFrame } from "../gate-layout";
import { AdminSignInForm } from "./form";

export const metadata: Metadata = { title: "Admin sign in" };

/** Admin console login. Separate from member sign-in; no link to it from the member app. */
export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ expired?: string; error?: string }> }) {
  const { expired, error } = await searchParams;
  return (
    <GateFrame title="Sign in" description="For the VentureWeavers team only.">
      {expired ? <FormNote state={{ message: "You were signed out after a period without activity." }} /> : null}
      {error === "link" ? <FormNote state={{ error: "That invite link has expired or was already used. Ask for a new invite." }} /> : null}
      <AdminSignInForm />
    </GateFrame>
  );
}
