/** Search used by the top-bar search in the member app and the admin console. Pure, so it can be tested. */

export type SearchHit = { group: string; title: string; sub: string; href: string; space?: "Outloud" | "TVS" | "BRICKR" | "QuidQuo" | "House" };

/** Lowercase, strip accents and extra spaces. */
export function normalize(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Every word of the query must appear somewhere in the fields. Titles that match score higher. */
export function score(q: string, title: string, rest: (string | null | undefined)[]): number {
  const words = normalize(q).split(" ").filter(Boolean);
  if (!words.length) return 0;
  const t = normalize(title);
  const all = `${t} ${normalize(rest.filter(Boolean).join(" "))}`;
  if (!words.every((w) => all.includes(w))) return 0;
  let s = 1;
  for (const w of words) if (t.includes(w)) s += 2;
  if (t.startsWith(words[0])) s += 1;
  if (t === normalize(q)) s += 3;
  return s;
}

/** Score items, drop non-matches, best first, at most `limit`. */
export function rank<T>(q: string, items: T[], fields: (x: T) => [string, ...(string | null | undefined)[]], limit = 8): T[] {
  return items
    .map((x) => {
      const [title, ...rest] = fields(x);
      return { x, s: score(q, title, rest) };
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.x);
}

export const cleanQuery = (q: string | undefined) => (q ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
