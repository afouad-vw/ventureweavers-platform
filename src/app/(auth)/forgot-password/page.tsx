import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetRequestForm } from "./form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
        <p className="text-[13.5px] text-muted">Enter your email and we&apos;ll send you a link to set a new password.</p>
      </div>
      <ResetRequestForm />
      <p className="text-[13px] text-muted">
        <Link href="/sign-in" className="font-bold text-link hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
