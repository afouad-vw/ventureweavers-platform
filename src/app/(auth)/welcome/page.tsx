import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { requireMember } from "@/lib/auth/guards";
import { safeNext } from "@/lib/auth/policy";
import { INTERESTS, splitPhone } from "@/lib/profile/about";
import { countryByName } from "@/lib/profile/countries";
import { createClient } from "@/lib/supabase/server";
import { AboutForm } from "./about-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About you", robots: { index: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const member = await requireMember("/welcome");
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, phone, linkedin, country, role, goals, contact_prefs, consent_newsletter, onboarded_at, avatar_url, business_name, business_website, business_type")
    .eq("id", member.id)
    .maybeSingle();
  const country = countryByName(p?.country);
  const phone = splitPhone(p?.phone, country?.code ?? "EG");
  return (
    <AuthLayout>
      <AboutForm
        returning={Boolean(p?.onboarded_at)}
        next={safeNext(next)}
        initial={{
          name: p?.full_name ?? member.name ?? "",
          email: member.email ?? "",
          dialCountry: phone.dialCountry,
          phone: phone.number,
          linkedin: p?.linkedin ?? "",
          country: p?.country ?? "",
          role: p?.role ?? "",
          interests: ((p?.goals as string[] | null) ?? []).filter((g) => (INTERESTS as readonly string[]).includes(g)),
          contact: (p?.contact_prefs as string[] | null) ?? [],
          newsletter: p?.consent_newsletter ?? !p?.onboarded_at,
          avatar: p?.avatar_url ?? null,
          businessName: p?.business_name ?? "",
          businessWebsite: p?.business_website ?? "",
          businessType: p?.business_type ?? "",
        }}
      />
    </AuthLayout>
  );
}
