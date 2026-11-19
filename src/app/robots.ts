import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { robotsFor, seoHost } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return robotsFor(seoHost((await headers()).get("host")));
}
