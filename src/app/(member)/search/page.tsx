import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { PageHeader } from "@/components/ui/misc";
import { listServices } from "@/lib/brickr/queries";
import { blogPosts, contentItems, libraryResources } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";
import { listUpcomingEvents } from "@/lib/events/queries";
import { cleanQuery, rank, type SearchHit } from "@/lib/search";
import { listPrograms } from "@/lib/tvs/queries";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = cleanQuery((await searchParams).q);
  let hits: SearchHit[] = [];
  if (q) {
    const [events, programs, services, blog, content, library] = await Promise.all([
      listUpcomingEvents("all"),
      listPrograms(),
      listServices(),
      blogPosts(),
      contentItems(),
      libraryResources().catch(() => []),
    ]);
    const dated = events.filter((e) => e.type !== "private_session");
    hits = [
      ...rank(q, dated.filter((e) => e.type !== "masterclass"), (e) => [e.title, e.description, e.venue, e.hosts, e.guest]).map((e) => ({ group: "Shows & events", title: e.title, sub: [e.starts_at ? formatDate(e.starts_at) : "", e.venue].filter(Boolean).join(" · "), href: `/outloud/events/${e.slug}`, space: "Outloud" as const })),
      ...rank(q, dated.filter((e) => e.type === "masterclass"), (e) => [e.title, e.description, e.hosts, e.format]).map((e) => ({ group: "Masterclasses", title: e.title, sub: [e.starts_at ? formatDate(e.starts_at) : "", e.format].filter(Boolean).join(" · "), href: "/tvs?tab=masterclasses", space: "TVS" as const })),
      ...rank(q, programs, (p) => [p.name, p.description, p.kind, p.tags.join(" ")]).map((p) => ({ group: "Programs", title: p.name, sub: p.kind, href: "/tvs", space: "TVS" as const })),
      ...rank(q, services, (s) => [s.name, s.description, s.audience, s.format, s.tags.join(" ")]).map((s) => ({ group: "Services", title: s.name, sub: s.audience, href: s.space === "Outloud" ? "/outloud" : "/brickr", space: s.space })),
      ...rank(q, blog, (b) => [b.title, b.summary, b.category, b.author, b.body]).map((b) => ({ group: "Blog", title: b.title, sub: `${b.category} · ${formatDate(b.published_on)}`, href: `/outloud/blog/${b.slug}`, space: "Outloud" as const })),
      ...rank(q, content, (c) => [c.title, c.series, c.format, c.platform]).map((c) => ({ group: "Shows & clips", title: c.title, sub: `${c.format} · ${c.platform}`, href: "/outloud?tab=content", space: "Outloud" as const })),
      ...rank(q, library, (r) => [r.title, r.description, r.kind, r.space]).map((r) => ({ group: "Library", title: r.title, sub: r.kind, href: `/library?q=${encodeURIComponent(r.title)}` })),
    ];
  }
  return (
    <>
      <PageHeader title="Search" description="Shows, programs, masterclasses, services, the blog and the Library." />
      <SearchResults q={q} action="/search" hits={hits} placeholder="Search shows, programs, resources" hint="Type a word, like pricing, angels or Open Floor." />
    </>
  );
}
