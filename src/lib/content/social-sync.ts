import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { getInstagramToken } from "./instagram-token";
import { findPreview } from "./preview";
import {
  LOOSE_EPISODES,
  SHORTS_LIMIT,
  parseInstagramMedia,
  parsePlaylists,
  parseYouTubePlaylist,
  shortIdsFromVideos,
  uploadsPlaylist,
  type SyncedItem,
} from "./social-parse";

/**
 * Keeps Outloud's digital content up to date from the VentureWeavers accounts:
 * - YouTube (@Venture_Weavers, YOUTUBE_API_KEY, optional YOUTUBE_HANDLE): videos become Episodes;
 *   each public playlist is a show, videos in no playlist go under "More episodes". Shorts on YouTube are skipped.
 * - Instagram (token pasted in admin and renewed by the daily cron; INSTAGRAM_ACCESS_TOKEN as fallback): reels become Shorts.
 * - Every run also finds preview images for posts admins added by link (TikTok, YouTube).
 * Pulled posts are published straight away; admins can set one to Draft to hide it (it stays hidden).
 */

type Source = "youtube" | "instagram";
export type SyncResult = { source: Source; ok: boolean; added: number; error?: string };

const STALE_MINUTES = 60;
const YT = "https://www.googleapis.com/youtube/v3";
const PER_PLAYLIST = 50;

export const configuredSources = async (): Promise<Source[]> =>
  [process.env.YOUTUBE_API_KEY ? "youtube" : null, (await getInstagramToken()) ? "instagram" : null].filter(Boolean) as Source[];

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function fetchYouTube(): Promise<{ items: SyncedItem[]; shows: { name: string; description: string }[] }> {
  const key = process.env.YOUTUBE_API_KEY!;
  const handle = (process.env.YOUTUBE_HANDLE ?? "Venture_Weavers").replace(/^@/, "");
  const ch = await getJson(`${YT}/channels?part=id&forHandle=${encodeURIComponent("@" + handle)}&key=${key}`);
  const channelId = (ch.json as { items?: { id?: string }[] })?.items?.[0]?.id;
  if (!channelId) throw new Error(ch.status === 200 ? `No YouTube channel @${handle}` : `YouTube said ${ch.status}`);

  // Each public playlist is a show.
  const pl = await getJson(`${YT}/playlists?part=snippet,status&channelId=${channelId}&maxResults=50&key=${key}`);
  if (pl.status !== 200) throw new Error(`YouTube said ${pl.status}`);
  const playlists = parsePlaylists(pl.json);
  const seen = new Set<string>();
  const items: SyncedItem[] = [];
  const add = (list: SyncedItem[]) => {
    for (const it of list) {
      if (seen.has(it.external_id)) continue;
      seen.add(it.external_id);
      items.push(it);
    }
  };
  for (const p of playlists) {
    const r = await getJson(`${YT}/playlistItems?part=snippet,contentDetails&maxResults=${PER_PLAYLIST}&playlistId=${p.id}&key=${key}`);
    if (r.status !== 200) continue;
    add(parseYouTubePlaylist(r.json, p.title));
  }
  // Recent uploads that aren't in any playlist.
  const up = await getJson(`${YT}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploadsPlaylist(channelId)}&key=${key}`);
  if (up.status === 200) add(parseYouTubePlaylist(up.json, LOOSE_EPISODES));

  // Leave out YouTube Shorts (3 minutes or less): Shorts come from Instagram and TikTok.
  const shorts = new Set<string>();
  for (let i = 0; i < items.length; i += 50) {
    const v = await getJson(`${YT}/videos?part=contentDetails&id=${items.slice(i, i + 50).map((x) => x.external_id).join(",")}&key=${key}`);
    for (const id of shortIdsFromVideos(v.json)) shorts.add(id);
  }
  const episodes = items.filter((x) => !shorts.has(x.external_id));
  const used = new Set(episodes.map((e) => e.series));
  const shows = playlists.filter((p) => used.has(p.title)).map((p) => ({ name: p.title, description: p.description }));
  if (used.has(LOOSE_EPISODES)) shows.push({ name: LOOSE_EPISODES, description: "" });
  return { items: episodes, shows };
}

async function fetchInstagram(): Promise<{ items: SyncedItem[]; shows: { name: string; description: string }[] }> {
  const token = await getInstagramToken();
  if (!token) throw new Error("Instagram isn't connected");
  const fields = "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp";
  const r = await getJson(`https://graph.instagram.com/me/media?fields=${fields}&limit=30`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status !== 200) throw new Error(`Instagram said ${r.status} (the access token may have expired)`);
  return { items: parseInstagramMedia(r.json).slice(0, SHORTS_LIMIT), shows: [{ name: "Shorts", description: "" }] };
}

async function store(source: Source, rows: SyncedItem[], shows: { name: string; description: string }[]): Promise<number> {
  const svc = createServiceClient();
  // Make sure every show exists (new playlists appear as new sections; existing ones keep their admin edits).
  if (shows.length) await svc.from("content_series").upsert(shows.map((s, i) => ({ name: s.name, description: s.description, position: 1000 + i })), { onConflict: "name", ignoreDuplicates: true });
  if (!rows.length) return 0;
  const { data: existing } = await svc.from("content_items").select("id, external_id").eq("source", source).in("external_id", rows.map((r) => r.external_id));
  const have = new Map(((existing ?? []) as { id: string; external_id: string }[]).map((e) => [e.external_id, e.id]));
  const fresh = rows.filter((r) => !have.has(r.external_id));
  if (fresh.length) {
    const { error } = await svc.from("content_items").insert(fresh.map((r) => ({ ...r, status: "published" })));
    if (error) throw new Error("Couldn't save the new posts");
  }
  // Preview links can change (Instagram's expire), so refresh them on items we already have (titles stay as edited).
  await Promise.all(rows.filter((r) => have.has(r.external_id) && r.thumb_url).map((r) => svc.from("content_items").update({ thumb_url: r.thumb_url }).eq("id", have.get(r.external_id)!)));
  return fresh.length;
}

async function runOne(source: Source): Promise<SyncResult> {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  try {
    const { items, shows } = source === "youtube" ? await fetchYouTube() : await fetchInstagram();
    const added = await store(source, items, shows);
    await svc.from("social_sync").upsert({ source, last_run_at: now, last_ok_at: now, last_count: added, last_error: null });
    return { source, ok: true, added };
  } catch (e) {
    const error = (e instanceof Error ? e.message : "Sync failed").slice(0, 300);
    await svc.from("social_sync").upsert({ source, last_run_at: now, last_error: error });
    return { source, ok: false, added: 0, error };
  }
}

/** Preview images for posts added by link without one (TikTok and YouTube; Instagram tiles show Instagram's own preview). */
export async function refreshPreviews(limit = 8): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("content_items")
    .select("id, url")
    .is("image_url", null)
    .is("thumb_url", null)
    .not("url", "is", null)
    .in("platform", ["TikTok", "YouTube"])
    .limit(limit);
  let n = 0;
  for (const r of (data ?? []) as { id: string; url: string }[]) {
    const thumb = await findPreview(r.url).catch(() => null);
    if (thumb) {
      await svc.from("content_items").update({ thumb_url: thumb }).eq("id", r.id);
      n++;
    }
  }
  return n;
}

/** Sync every configured account. With force = false, only those not synced in the last hour. */
export async function syncSocial({ force = false } = {}): Promise<SyncResult[]> {
  if (!supabaseConfigured) return [];
  const sources = await configuredSources();
  let due = sources;
  if (!force && sources.length) {
    const { data } = await createServiceClient().from("social_sync").select("source, last_run_at").in("source", sources);
    const last = new Map(((data ?? []) as { source: Source; last_run_at: string | null }[]).map((r) => [r.source, r.last_run_at]));
    const cutoff = Date.now() - STALE_MINUTES * 60_000;
    due = sources.filter((s) => !last.get(s) || new Date(last.get(s)!).getTime() < cutoff);
  }
  const results = await Promise.all(due.map(runOne));
  if (force || due.length) await refreshPreviews().catch(() => 0);
  return results;
}
