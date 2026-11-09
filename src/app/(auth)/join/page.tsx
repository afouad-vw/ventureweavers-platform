import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FormNote } from "@/components/auth/form-note";
import { safeNext } from "@/lib/auth/policy";
import { AuthLayout } from "@/components/auth/auth-layout";
import { EmailPasswordForm, OrDivider } from "@/components/auth/email-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";

export const metadata: Metadata = { title: "Join" };

const perks = [
  "Book Open Floor seats and private sessions",
  "Apply to TVS programs and masterclasses",
  "Request a meeting with BRICKR",
  "Join the QuidQuo waitlist",
];

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safe = safeNext(next, "");
  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Join VentureWeavers</h1>
        <p className="text-[13.5px] text-muted">One account for every space. Use Google, LinkedIn or your email.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[13.5px]">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
      {error === "link" ? <FormNote state={{ error: "That link has expired or was already used. Please try again." }} /> : null}
      <ProviderButtons verb="Sign up" next={safe || undefined} />
      <OrDivider />
      <EmailPasswordForm mode="sign-up" next={safe || undefined} />
      <p className="text-xs text-faint">
        After you sign up we ask for your role, stage and interests to shape your feed. By joining you agree to the [TERMS] and [PRIVACY POLICY].
      </p>
      <p className="text-[13px] text-muted">
        Already a member?{" "}
        <Link href="/sign-in" className="font-bold text-link hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
