import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdminBase } from "@/lib/auth/guards";
import { adminHref } from "@/lib/hosts";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GateFrame } from "../gate-layout";
import { VerifyForm } from "./form";

export const metadata: Metadata = { title: "2-step verification" };
export const dynamic = "force-dynamic";

/** Second step of admin sign-in. The first time, it shows a QR code to add the account to an authenticator app. */
export default async function VerifyPage() {
  const to = adminHref("/admin/sign-in", await currentAdminBase());
  if (!supabaseConfigured) redirect(to);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(to);
  const { data: admin } = await createServiceClient().from("admin_users").select("username").eq("user_id", userId).maybeSingle();
  if (!admin) redirect(to);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (verified) {
    return (
      <GateFrame title="Enter your code" description="Open your authenticator app and enter the 6-digit code for VentureWeavers.">
        <VerifyForm factorId={verified.id} />
      </GateFrame>
    );
  }

  // First time: clear any half-finished setup, then start a new one.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data: enrol, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "VentureWeavers admin", issuer: "VentureWeavers" });
  if (error || !enrol) redirect(to);

  return (
    <GateFrame title="Set up 2-step verification" description="Scan this code with an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator), then enter the 6-digit code it shows.">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from Supabase, not an optimizable image */}
      <img src={enrol.totp.qr_code} alt="QR code for your authenticator app" width={180} height={180} className="mx-auto rounded-lg bg-white p-2" />
      <details className="text-[12.5px] text-muted">
        <summary className="cursor-pointer font-bold">Can&apos;t scan? Enter this key instead</summary>
        <code className="mt-2 block rounded-md bg-hover px-2 py-1.5 font-mono text-[12px] break-all select-all">{enrol.totp.secret}</code>
      </details>
      <VerifyForm factorId={enrol.id} />
    </GateFrame>
  );
}
