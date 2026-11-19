import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { seoHost, sitemapFor } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapFor(seoHost((await headers()).get("host")));
}
