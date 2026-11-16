import { describe, expect, it } from "vitest";
import { cairoDate, isoSeconds, parseInstagramMedia, parseYouTubePlaylist, shortIdsFromVideos, shortTitle, shortsPlaylist, uploadsPlaylist } from "./social-parse";
import { groupEpisodes } from "./series";

describe("Shorts from YouTube", () => {
  it("finds the channel's Shorts and uploads playlists", () => {
    expect(shortsPlaylist("UCabcdefghijklmnopqrstuv")).toBe("UUSHabcdefghijklmnopqrstuv");
    expect(uploadsPlaylist("UCabcdefghijklmnopqrstuv")).toBe("UUabcdefghijklmnopqrstuv");
    expect(shortsPlaylist("not a channel")).toBeNull();
  });
  it("reads playlist items into Shorts", () => {
    const rows = parseYouTubePlaylist({
      items: [
        { snippet: { title: "What do angels look for? #shorts #vc", publishedAt: "2026-11-16T23:30:00Z", thumbnails: { high: { url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" } } }, contentDetails: { videoId: "abcdefghijk", videoPublishedAt: "2026-11-16T23:30:00Z" } },
        { snippet: { title: "Private video" }, contentDetails: { videoId: "zzzzzzzzzzz" } },
        { snippet: { title: "Bad id" }, contentDetails: { videoId: "<script>" } },
      ],
    });
    expect(rows).toEqual([
      { source: "youtube", external_id: "abcdefghijk", title: "What do angels look for?", platform: "YouTube", url: "https://www.youtube.com/shorts/abcdefghijk", thumb_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", publish_on: "2026-11-17" },
    ]);
  });
  it("tells Shorts by length when the Shorts playlist isn't available", () => {
    expect(isoSeconds("PT59S")).toBe(59);
    expect(isoSeconds("PT1M5S")).toBe(65);
    expect(isoSeconds("PT1H")).toBe(3600);
    expect(isoSeconds("P1D")).toBe(Infinity);
    expect([...shortIdsFromVideos({ items: [{ id: "a", contentDetails: { duration: "PT45S" } }, { id: "b", contentDetails: { duration: "PT12M" } }, { id: "c", contentDetails: { duration: "PT3M" } }] })]).toEqual(["a", "c"]);
  });
});

describe("Reels from Instagram", () => {
  it("keeps Reels with an instagram.com link", () => {
    const rows = parseInstagramMedia({
      data: [
        { id: "17900000000000001", caption: "\nOpen Floor 01: the room asked about pricing\n#openfloor", media_type: "VIDEO", media_product_type: "REELS", permalink: "https://www.instagram.com/reel/ABC123/", thumbnail_url: "https://scontent.cdninstagram.com/x.jpg", timestamp: "2026-11-10T10:00:00+0000" },
        { id: "17900000000000002", caption: "A photo", media_type: "IMAGE", media_product_type: "FEED", permalink: "https://www.instagram.com/p/XYZ/" },
        { id: "17900000000000003", media_type: "VIDEO", media_product_type: "REELS", permalink: "https://evil.example/reel" },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ external_id: "17900000000000001", title: "Open Floor 01: the room asked about pricing", platform: "Instagram", publish_on: "2026-11-10" });
  });
});

describe("titles and dates", () => {
  it("makes a title the table accepts", () => {
    expect(shortTitle("#shorts #vc")).toBe("Short");
    expect(shortTitle("")).toBe("Short");
    expect(shortTitle("x".repeat(300))).toHaveLength(158);
  });
  it("uses the Cairo date", () => {
    expect(cairoDate("2026-11-16T22:30:00Z")).toBe("2026-11-17");
    expect(cairoDate("2026-11-16T12:00:00Z")).toBe("2026-11-16");
  });
});

describe("episodes by series", () => {
  it("groups episodes and puts the series with the newest episode first", () => {
    const series = [{ name: "Open Floor", position: 1 }, { name: "The Answer", position: 2 }];
    const eps = [
      { id: "a", series: "Open Floor", publish_on: "2026-10-01" },
      { id: "b", series: "The Answer", publish_on: "2026-11-01" },
      { id: "c", series: "Open Floor", publish_on: "2026-10-20" },
    ];
    const g = groupEpisodes(eps, series);
    expect(g.map((x) => x.series.name)).toEqual(["The Answer", "Open Floor"]);
    expect(g[1].episodes.map((e) => e.id)).toEqual(["c", "a"]);
  });
  it("leaves out series with no episodes", () => {
    expect(groupEpisodes([], [{ name: "Open Floor", position: 1 }])).toEqual([]);
  });
});
