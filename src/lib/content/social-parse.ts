/**
 * Turns the YouTube and Instagram API replies into Shorts rows for content_items.
 * Pure functions, so they are tested without calling the APIs (social-parse.test.ts).
 */

export type SyncedShort = {
  source: "youtube" | "instagram";
  external_id: string;
  title: string;
  platform: "YouTube" | "Instagram";
  url: string;
  thumb_url: string | null;
  publish_on: string; // YYYY-MM-DD (Cairo date)
};

export const SHORTS_LIMIT = 10;

/** The date in Cairo for an ISO time, as YYYY-MM-DD. */
export function cairoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** A title the table accepts (3–160 characters): the first line of the caption, without hashtags. */
export function shortTitle(raw: string | null | undefined, fallback = "Short"): string {
  const first = String(raw ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const clean = first.replace(/(^|\s)#[^\s#]+/g, " ").replace(/\s+/g, " ").trim();
  const t = clean.length >= 3 ? clean : fallback;
  return t.length > 160 ? `${t.slice(0, 157).trimEnd()}…` : t;
}

const httpsOrNull = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s<>"]+$/.test(v) && v.length <= 1000 ? v : null);

type YtThumbs = Record<string, { url?: string } | undefined> | undefined;
type YtPlaylistItem = {
  snippet?: { title?: string; publishedAt?: string; thumbnails?: YtThumbs; resourceId?: { videoId?: string } };
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
};

/** "UCabc…" → the channel's Shorts playlist "UUSHabc…" (and "UUabc…" for all uploads). */
export const shortsPlaylist = (channelId: string) => (/^UC[\w-]{22}$/.test(channelId) ? `UUSH${channelId.slice(2)}` : null);
export const uploadsPlaylist = (channelId: string) => (/^UC[\w-]{22}$/.test(channelId) ? `UU${channelId.slice(2)}` : null);

export function parseYouTubePlaylist(json: unknown): SyncedShort[] {
  const items = ((json as { items?: YtPlaylistItem[] })?.items ?? []) as YtPlaylistItem[];
  const out: SyncedShort[] = [];
  for (const it of items) {
    const id = it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId ?? "";
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    const title = it.snippet?.title ?? "";
    if (title === "Private video" || title === "Deleted video") continue;
    const th = it.snippet?.thumbnails;
    out.push({
      source: "youtube",
      external_id: id,
      title: shortTitle(title),
      platform: "YouTube",
      url: `https://www.youtube.com/shorts/${id}`,
      thumb_url: httpsOrNull(th?.maxres?.url ?? th?.standard?.url ?? th?.high?.url ?? th?.medium?.url ?? th?.default?.url),
      publish_on: cairoDate(it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt ?? ""),
    });
  }
  return out;
}

/** "PT1M5S" → 65. Unknown → Infinity (treated as not a Short). */
export function isoSeconds(d: string | undefined): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d ?? "");
  if (!m) return Infinity;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Video ids whose length makes them Shorts (3 minutes or less), from a videos?part=contentDetails reply. */
export function shortIdsFromVideos(json: unknown): Set<string> {
  const items = ((json as { items?: { id?: string; contentDetails?: { duration?: string } }[] })?.items ?? []);
  return new Set(items.filter((v) => v.id && isoSeconds(v.contentDetails?.duration) <= 180).map((v) => v.id!));
}

type IgMedia = { id?: string; caption?: string; media_type?: string; media_product_type?: string; permalink?: string; thumbnail_url?: string; timestamp?: string };

/** Reels from an Instagram me/media reply. */
export function parseInstagramMedia(json: unknown): SyncedShort[] {
  const items = ((json as { data?: IgMedia[] })?.data ?? []) as IgMedia[];
  const out: SyncedShort[] = [];
  for (const m of items) {
    if (!m.id || !/^\d{1,40}$/.test(m.id)) continue;
    if (m.media_product_type !== "REELS" && m.media_type !== "VIDEO") continue;
    const url = httpsOrNull(m.permalink);
    if (!url || !/^https:\/\/(www\.)?instagram\.com\//.test(url)) continue;
    out.push({
      source: "instagram",
      external_id: m.id,
      title: shortTitle(m.caption, "Reel"),
      platform: "Instagram",
      url,
      thumb_url: httpsOrNull(m.thumbnail_url),
      publish_on: cairoDate(m.timestamp ?? ""),
    });
  }
  return out;
}
