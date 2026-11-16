import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS } from "@/lib/legal/text";

export const metadata: Metadata = { title: "Terms of Use", description: "The terms for using the VentureWeavers website and member app." };

export default function TermsPage() {
  return <LegalPage title="Terms of Use" source={TERMS} other={{ href: "/privacy", label: "Privacy Policy" }} />;
}
