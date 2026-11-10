import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetails } from "@/components/details/event-details";
import { getEventBySlug } from "@/lib/events/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  return { title: e?.title ?? "Masterclass", description: (e?.short_description || e?.description || "").slice(0, 160) || undefined };
}

export default async function MasterclassPage({ params }: Props) {
  const e = await getEventBySlug((await params).slug);
  if (!e || e.type !== "masterclass") notFound();
  return <EventDetails e={e} />;
}
