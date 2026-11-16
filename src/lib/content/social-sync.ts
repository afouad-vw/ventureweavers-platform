import "server-only";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import {
  SHORTS_LIMIT,
  parseInstagramMedia,
  parseYouTubePlaylist,
  shortIdsFromVideos,
  shortsPlaylist,
  uploadsPlaylist,
  type SyncedShort,
} from "./social-parse";

/**
 * Pulls the latest Shorts from the @ventureweavers accounts into content_items.
 * YouTube needs YOUTUBE_API_KEY (and optionally YOUTUBE_HANDLE, default "Venture_Weavers").
 * Instagram needs INSTAGRAM_ACCESS_TOKEN (Instagram API with Instagram Login, a 60-day token).
 * Synced posts are published straight away; admins can set one to Draft to hide it (it stays hidden).
 */

type Source = "youtube" | "instagram";
export type SyncResult = { source: Source; ok: boolean; added: number; error?: string };

const STALE_MINUTES = 60;
const YT = "https://www.googleapis.com/youtube/v3";

export const configuredSources = (): Source[] =>
  [process.env.YOUTUBE_API_KEY ? "youtube" : null, process.env.INSTAGRAM_ACCESS_TOKEN ? "instagram" : null].filter(Boolean) as Source[];

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function fetchYouTube(): Promise<SyncedShort[]> {
  const key = process.env.YOUTUBE_API_KEY!;
  const handle = (process.env.YOUTUBE_HANDLE ?? "Venture_Weavers").replace(/^@/, "");
  const ch = await getJson(`${YT}/channels?part=id&forHandle=${encodeURIComponent("@" + handle)}&key=${key}`);
  const channelId = (ch.json as { items?: { id?: string }[] })?.items?.[0]?.id;
  if (!channelId) throw new Error(ch.status === 200 ? `No YouTube channel @${handle}` : `YouTube said ${ch.status}`);

  // The channel's own Shorts playlist; if YouTube doesn't offer it, recent uploads of 3 minutes or less.
  const sp = shortsPlaylist(channelId)!;
  const shorts = await getJson(`${YT}/playlistItems?part=snippet,contentDetails&maxResults=${SHORTS_LIMIT}&playlistId=${sp}&key=${key}`);
  if (shorts.status === 200) return parseYouTubePlaylist(shorts.json);

  const up = await getJson(`${YT}/playlistItems?part=snippet,contentDetails&maxResults=30&playlistId=${uploadsPlaylist(channelId)}&key=${key}`);
  if (up.status !== 200) throw new Error(`YouTube said ${up.status}`);
  const all = parseYouTubePlaylist(up.json);
  if (!all.length) return [];
  const vids = await getJson(`${YT}/videos?part=contentDetails&id=${all.map((s) => s.external_id).join(",")}&key=${key}`);
  const ok = shortIdsFromVideos(vids.json);
  return all.filter((s) => ok.has(s.external_id)).slice(0, SHORTS_LIMIT);
}

async function fetchInstagram(): Promise<SyncedShort[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const fields = "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp";
  const r = await getJson(`https://graph.instagram.com/me/media?fields=${fields}&limit=30`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status !== 200) throw new Error(`Instagram said ${r.status}${r.status === 190 || r.status === 400 ? " (the access token may have expired)" : ""}`);
  return parseInstagramMedia(r.json).slice(0, SHORTS_LIMIT);
}

async function store(source: Source, rows: SyncedShort[]): Promise<number> {
  if (!rows.length) return 0;
  const svc = createServiceClient();
  const { data: existing } = await svc.from("content_items").select("id, external_id").eq("source", source).in("external_id", rows.map((r) => r.external_id));
  const have = new Map(((existing ?? []) as { id: string; external_id: string }[]).map((e) => [e.external_id, e.id]));
  const fresh = rows.filter((r) => !have.has(r.external_id));
  if (fresh.length) {
    const { error } = await svc.from("content_items").insert(fresh.map((r) => ({ ...r, series: "Shorts", format: "Short", status: "published" })));
    if (error) throw new Error("Couldn't save the new Shorts");
  }
  // Instagram preview links expire, so refresh them on items we already have (titles stay as edited).
  await Promise.all(rows.filter((r) => have.has(r.external_id) && r.thumb_url).map((r) => svc.from("content_items").update({ thumb_url: r.thumb_url }).eq("id", have.get(r.external_id)!)));
  return fresh.length;
}

async function runOne(source: Source): Promise<SyncResult> {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  try {
    const rows = source === "youtube" ? await fetchYouTube() : await fetchInstagram();
    const added = await store(source, rows);
    await svc.from("social_sync").upsert({ source, last_run_at: now, last_ok_at: now, last_count: added, last_error: null });
    return { source, ok: true, added };
  } catch (e) {
    const error = (e instanceof Error ? e.message : "Sync failed").slice(0, 300);
    await svc.from("social_sync").upsert({ source, last_run_at: now, last_error: error });
    return { source, ok: false, added: 0, error };
  }
}

/** Sync every configured account. With force = false, only those not synced in the last hour. */
export async function syncSocial({ force = false } = {}): Promise<SyncResult[]> {
  if (!supabaseConfigured) return [];
  const sources = configuredSources();
  if (!sources.length) return [];
  let due = sources;
  if (!force) {
    const { data } = await createServiceClient().from("social_sync").select("source, last_run_at").in("source", sources);
    const last = new Map(((data ?? []) as { source: Source; last_run_at: string | null }[]).map((r) => [r.source, r.last_run_at]));
    const cutoff = Date.now() - STALE_MINUTES * 60_000;
    due = sources.filter((s) => !last.get(s) || new Date(last.get(s)!).getTime() < cutoff);
  }
  return Promise.all(due.map(runOne));
}
