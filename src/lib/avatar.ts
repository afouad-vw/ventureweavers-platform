/**
 * Sign-in providers hand out small profile photos (Google: 96 px). Ask Google for a larger copy so the photo
 * stays sharp when shown big (the house look's My space). Other photos are returned as they are.
 */
export function sharpAvatar(url: string | null | undefined, size = 640): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)googleusercontent\.com$/.test(u.hostname)) return url;
    // ".../photo.jpg=s96-c" or "...=s96" → "=s640-c"; no size suffix → add one.
    if (/=s\d+(-c)?$/.test(u.pathname)) u.pathname = u.pathname.replace(/=s\d+(-c)?$/, `=s${size}-c`);
    else if (!u.pathname.includes("=")) u.pathname += `=s${size}-c`;
    return u.toString();
  } catch {
    return url;
  }
}
