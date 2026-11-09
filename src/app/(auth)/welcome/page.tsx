import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { requireMember } from "@/lib/auth/guards";
import { safeNext } from "@/lib/auth/policy";
import { WelcomeSteps } from "./steps";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const member = await requireMember("/welcome");
  const { next } = await searchParams;
  return (
    <AuthLayout>
      <WelcomeSteps name={member.name ?? ""} next={safeNext(next)} />
    </AuthLayout>
  );
}
