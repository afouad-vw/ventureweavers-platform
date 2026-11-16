import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PRIVACY } from "@/lib/legal/text";

export const metadata: Metadata = { title: "Privacy Policy", description: "How VentureWeavers collects, uses and protects your personal data." };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" source={PRIVACY} other={{ href: "/terms", label: "Terms of Use" }} />;
}
