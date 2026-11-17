import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireMember } from "@/lib/auth/guards";
import { businessesOf } from "@/lib/profile/businesses";
import { createClient } from "@/lib/supabase/server";
import { ShareNewsForm } from "./share-news-form";

export const metadata: Metadata = { title: "Share your news" };

export default async function ShareNewsPage() {
  const member = await requireMember("/share-news");
  const supabase = await createClient();
  const [businesses, { data: p }] = await Promise.all([businessesOf(member.id), supabase.from("profiles").select("full_name, phone").eq("id", member.id).maybeSingle()]);
  return (
    <>
      <Link href="/my-space?tab=news" className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        My news
      </Link>
      <PageHeader
        title="Share your news"
        description="Raised a round, launched something, signed a partner? Tell us. We review every submission and may feature it in the VW Newsletter or VW Notes."
      />
      <Card className="max-w-[760px]">
        <ShareNewsForm
          businesses={businesses.map((b) => b.name)}
          contact={{ name: p?.full_name || member.name || "", email: member.email ?? "", phone: p?.phone ?? "" }}
        />
      </Card>
    </>
  );
}
