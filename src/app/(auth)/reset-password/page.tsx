import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { getMember } from "@/lib/auth/guards";
import { NewPasswordForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  if (!(await getMember())) redirect("/forgot-password");
  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
        <p className="text-[13.5px] text-muted">Choose a password you don&apos;t use anywhere else.</p>
      </div>
      <NewPasswordForm />
    </AuthLayout>
  );
}
