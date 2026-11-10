import type { Metadata } from "next";
import Link from "next/link";
import { FormNote } from "@/components/auth/form-note";
import { safeNext } from "@/lib/auth/policy";
import { AuthLayout } from "@/components/auth/auth-layout";
import { EmailPasswordForm, OrDivider } from "@/components/auth/email-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safe = safeNext(next, "");
  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
        <p className="text-[13.5px] text-muted">Sign in to your tickets, learning and requests.</p>
      </div>
      {error === "suspended" ? <FormNote state={{ error: "This account is suspended. If you think this is a mistake, email us at info@ventureweavers.com." }} /> : null}
      {error === "link" ? <FormNote state={{ error: "That link has expired or was already used. Please try again." }} /> : null}
      <ProviderButtons verb="Sign in" next={safe || undefined} />
      <OrDivider />
      <EmailPasswordForm mode="sign-in" next={safe || undefined} />
      <p className="text-[13px] text-muted">
        New here?{" "}
        <Link href="/join" className="font-bold text-link hover:underline">
          Join VentureWeavers
        </Link>
      </p>
    </AuthLayout>
  );
}
