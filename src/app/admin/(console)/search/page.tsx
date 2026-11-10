import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminInbox, adminServices } from "@/lib/brickr/queries";
import { adminBlog, adminContent, adminLibrary } from "@/lib/content/admin-queries";
import { loadPeople, type Contact } from "@/lib/contacts/queries";
import { slugOf } from "@/lib/contacts/slug";
import { canAny, type Perm } from "@/lib/auth/permissions";
import { adminListEvents } from "@/lib/events/admin-queries";
import { formatDate, formatEGP } from "@/lib/events/format";
import { statusLabel } from "@/lib/payments/format";
import { adminLedger } from "@/lib/payments/queries";
import { cleanQuery, rank, type SearchHit } from "@/lib/search";
import { adminPrograms } from "@/lib/tvs/queries";

export const metadata: Metadata = { title: "Search" };

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const base = await currentAdminBase();
  // Search only what this admin may open (Phase 14 access levels).
  const may = (...p: Perm[]) => canAny(admin, p);
  const none = <T,>(): Promise<T[]> => Promise.resolve([]);
  const q = cleanQuery((await searchParams).q);
  let hits: SearchHit[] = [];
  if (q) {
    const [{ contacts }, shows, classes, programs, services, inbox, blog, content, library, ledger] = await Promise.all([
      may("contacts.view") ? loadPeople() : Promise.resolve({ contacts: [] as Contact[] }),
      may("events.view") ? adminListEvents("outloud") : none<Awaited<ReturnType<typeof adminListEvents>>[number]>(),
      may("events.view", "tvs.view") ? adminListEvents("masterclasses") : none<Awaited<ReturnType<typeof adminListEvents>>[number]>(),
      may("tvs.view") ? adminPrograms() : none<Awaited<ReturnType<typeof adminPrograms>>[number]>(),
      may("brickr.view") ? adminServices() : none<Awaited<ReturnType<typeof adminServices>>[number]>(),
      may("requests.view") ? adminInbox() : none<Awaited<ReturnType<typeof adminInbox>>[number]>(),
      may("content.view") ? adminBlog() : none<Awaited<ReturnType<typeof adminBlog>>[number]>(),
      may("content.view") ? adminContent() : none<Awaited<ReturnType<typeof adminContent>>[number]>(),
      may("library.view") ? adminLibrary() : none<Awaited<ReturnType<typeof adminLibrary>>[number]>(),
      may("payments.view") ? adminLedger() : none<Awaited<ReturnType<typeof adminLedger>>[number]>(),
    ]);
    hits = [
      ...rank(q, contacts, (c) => [c.name, c.email, c.company, c.role, c.phone, c.spaces.join(" "), c.note]).map((c) => ({ group: "Contacts", title: c.name, sub: [c.role, c.company, c.email].filter(Boolean).join(" · "), href: `${base}/contacts/${slugOf(c.key)}` })),
      ...rank(q, [...shows, ...classes], (e) => [e.title, e.description, e.venue, e.hosts]).map((e) => ({ group: "Events", title: e.title, sub: `${e.starts_at ? formatDate(e.starts_at) : "On request"} · ${e.status === "published" ? "Published" : "Draft"}`, href: `${base}/outloud/events/${e.id}`, space: e.type === "masterclass" ? ("TVS" as const) : ("Outloud" as const) })),
      ...rank(q, inbox, (i) => [i.title, i.member, i.email, i.company, i.note]).map((i) => ({ group: "Requests & applications", title: `${i.member} · ${i.title}`, sub: i.company || (i.email ?? ""), href: `${base}/requests`, space: i.space })),
      ...rank(q, ledger, (p) => [p.reference, p.member, p.email, p.item]).map((p) => ({ group: "Payments", title: `${p.reference} · ${p.member}`, sub: `${p.item} · ${formatEGP(p.amount_piasters)} · ${statusLabel(p.status)}`, href: `${base}/payments?q=${encodeURIComponent(p.reference)}`, space: p.space })),
      ...rank(q, programs, (p) => [p.name, p.description, p.kind]).map((p) => ({ group: "Programs", title: p.name, sub: p.kind, href: `${base}/tvs`, space: "TVS" as const })),
      ...rank(q, services, (s) => [s.name, s.description, s.audience]).map((s) => ({ group: "Services", title: s.name, sub: s.audience, href: s.space === "Outloud" ? `${base}/outloud` : `${base}/brickr`, space: s.space })),
      ...rank(q, blog, (b) => [b.title, b.summary, b.category, b.body]).map((b) => ({ group: "Blog", title: b.title, sub: b.category, href: `${base}/outloud?tab=blog`, space: "Outloud" as const })),
      ...rank(q, content, (c) => [c.title, c.series, c.platform]).map((c) => ({ group: "Digital content", title: c.title, sub: `${c.format} · ${c.platform}`, href: `${base}/outloud?tab=content`, space: "Outloud" as const })),
      ...rank(q, library, (r) => [r.title, r.description, r.kind]).map((r) => ({ group: "Library", title: r.title, sub: r.kind, href: `${base}/library` })),
    ];
  }
  return (
    <>
      <PageHeader title="Search" description="Contacts, events, requests, payments and content." />
      <SearchResults q={q} action={`${base}/search`} hits={hits} placeholder="Search contacts, events, content" hint="Search by name, email, reference (VWB-, VWT-, VWP-) or title." />
    </>
  );
}
