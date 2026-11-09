import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdminBase } from "@/lib/auth/guards";
import { adminHref } from "@/lib/hosts";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { GateFrame } from "../gate-layout";
import { SetPasswordForm } from "./form";

export const metadata: Metadata = { title: "Set your password" };

/** Reached from the admin invite email. */
export default async function SetPasswordPage() {
  const to = adminHref("/admin/sign-in", await currentAdminBase());
  if (!supabaseConfigured) redirect(to);
  const { data } = await (await createClient()).auth.getClaims();
  if (!data?.claims?.sub) redirect(to);
  return (
    <GateFrame title="Set your password" description="Choose a password only you know, at least 12 characters. Next you'll set up 2-step verification.">
      <SetPasswordForm />
    </GateFrame>
  );
}
