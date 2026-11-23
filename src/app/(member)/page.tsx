import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HomeDashboard } from "@/components/home/dashboard";
import { isSpace } from "@/lib/content/format";
import { HOUSE_COOKIE, isHouseLook } from "@/lib/house";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  // In the house look the home screen is the house itself (drawn by the layout).
  if (isHouseLook((await cookies()).get(HOUSE_COOKIE)?.value)) return null;
  const { space: raw } = await searchParams;
  return <HomeDashboard space={raw && isSpace(raw) ? raw : "All"} />;
}
