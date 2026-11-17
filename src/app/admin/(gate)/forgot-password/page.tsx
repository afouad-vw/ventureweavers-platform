import type { Metadata } from "next";
import Link from "next/link";
import { currentAdminBase } from "@/lib/auth/guards";
import { adminHref } from "@/lib/hosts";
import { GateFrame } from "../gate-layout";
import { AdminForgotForm } from "./form";

export const metadata: Metadata = { title: "Forgot password" };

/** Admin "Forgot password": the link goes to the admin's own email address. */
export default async function AdminForgotPasswordPage() {
  const back = adminHref("/admin/sign-in", await currentAdminBase());
  return (
    <GateFrame title="Forgot password" description="Type your admin username. We'll email you a link to choose a new password.">
      <AdminForgotForm />
      <Link href={back} className="self-center text-[13.5px] font-bold text-link hover:underline">Back to sign in</Link>
    </GateFrame>
  );
}
