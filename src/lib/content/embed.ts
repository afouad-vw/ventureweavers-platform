/** Instagram or TikTok's own embed for a reel, as a link that the browser loads straight from the platform. */
export function embedFor(url: string | null): { src: string; width: number; height: number; offset: number } | null {
  if (!url) return null;
  const ig = /^https:\/\/(?:www\.)?instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/.exec(url);
  if (ig) return { src: `https://www.instagram.com/${ig[1] === "reels" ? "reel" : ig[1]}/${ig[2]}/embed/`, width: 326, height: 640, offset: 54 };
  const tt = /^https:\/\/(?:www\.|m\.)?tiktok\.com\/@[^/]+\/video\/(\d{8,25})/.exec(url);
  if (tt) return { src: `https://www.tiktok.com/embed/v2/${tt[1]}`, width: 325, height: 578, offset: 0 };
  return null;
}
