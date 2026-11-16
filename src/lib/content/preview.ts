import "server-only";
import { youtubeThumb } from "./format";

/** Hosts a post preview image may come from (they're also allowed in the page's image policy). */
const IMAGE_HOSTS = [/^i\.ytimg\.com$/, /(^|\.)tiktokcdn(-us|-eu)?\.com$/, /(^|\.)cdninstagram\.com$/, /(^|\.)fbcdn\.net$/, /^media\.licdn\.com$/];

export function allowedPreview(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 1000 || !/^https:\/\/[^\s<>"]+$/.test(url)) return null;
  try {
    const h = new URL(url).hostname;
    return IMAGE_HOSTS.some((r) => r.test(h)) ? url : null;
  } catch {
    return null;
  }
}

/** The og:image of a page's HTML, if any. */
export function ogImage(html: string): string | null {
  const m =
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

async function get(url: string, json = false): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VentureWeaversBot/1.0; +https://app.ventureweavers.com)", Accept: json ? "application/json" : "text/html" },
  });
  if (!res.ok) return null;
  return json ? res.json().catch(() => null) : (await res.text()).slice(0, 400_000);
}

/**
 * A preview image for a post link: the YouTube thumbnail, TikTok's own thumbnail, or the page's
 * og:image (Instagram, LinkedIn). Returns null when none can be found; the tile then shows a branded cover.
 */
export async function findPreview(link: string | null): Promise<string | null> {
  if (!link) return null;
  const yt = youtubeThumb(link);
  if (yt) return yt;
  let host = "";
  try {
    host = new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  try {
    if (/(^|\.)tiktok\.com$/.test(host)) {
      const o = (await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`, true)) as { thumbnail_url?: string } | null;
      return allowedPreview(o?.thumbnail_url);
    }
    if (/(^|\.)(instagram\.com|linkedin\.com)$/.test(host)) {
      const html = (await get(link)) as string | null;
      return html ? allowedPreview(ogImage(html)) : null;
    }
  } catch {
    return null;
  }
  return null;
}
