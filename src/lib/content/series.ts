/** Episodes grouped by show or series, for the collapsible Episodes list. */

type Item = { series: string; publish_on: string };
type S = { name: string; position: number };

/**
 * One group per series that has episodes. Groups are ordered by their newest episode (then the
 * admin's order); episodes inside a group stay newest first. Episodes of an unknown series are kept.
 */
export function groupEpisodes<E extends Item, T extends S>(episodes: E[], series: T[]): { series: T; episodes: E[] }[] {
  const byName = new Map(series.map((s) => [s.name, s]));
  const groups = new Map<string, E[]>();
  for (const e of episodes) {
    const list = groups.get(e.series) ?? [];
    list.push(e);
    groups.set(e.series, list);
  }
  const out = [...groups.entries()].map(([name, eps]) => ({
    series: byName.get(name) ?? ({ name, position: 9999, id: name, description: "" } as unknown as T),
    episodes: [...eps].sort((a, b) => b.publish_on.localeCompare(a.publish_on)),
  }));
  return out.sort((a, b) => b.episodes[0].publish_on.localeCompare(a.episodes[0].publish_on) || a.series.position - b.series.position);
}
