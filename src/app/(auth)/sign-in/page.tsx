import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ProviderButtons } from "@/components/auth/provider-buttons";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
        <p className="text-[13.5px] text-muted">Sign in to your tickets, learning and requests.</p>
      </div>
      <ProviderButtons verb="Sign in" />
      <p className="text-[13px] text-muted">
        New here?{" "}
        <Link href="/join" className="font-bold text-link hover:underline">
          Join VentureWeavers
        </Link>
      </p>
    </AuthLayout>
  );
}
