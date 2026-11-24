import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip-link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { REPORT_REASONS } from "@/lib/blong/format";
import { slugOf } from "@/lib/contacts/slug";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CommunityStatusButton, DiscussionStatusButton, ReportActions } from "./report-actions";
import { LinkTabs } from "@/components/ui/link-tabs";
import { blongPending } from "@/lib/blong/queries";
import { Approvals, Overview, Settings } from "./views";

export const metadata: Metadata = { title: "Community" };

type Report = {
  id: string; reporter: string; kind: string; target_id: string; target_member: string | null; reason: string;
  details: string | null; excerpt: string | null; status: "open" | "handled" | "dismissed"; note: string | null; handled_at: string | null; created_at: string;
};

const KIND: Record<string, string> = { member: "Member", message: "Member message", community: "Community", discussion: "Discussion", room_message: "Room message" };
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

type View = "overview" | "approvals" | "reports" | "communities" | "discussions" | "settings";
const VIEWS: { value: View; label: string; line: string }[] = [
  { value: "overview", label: "Overview", line: "How BLong is doing: members, activity, communities, discussions and reports. Numbers only; staff never read chats." },
  { value: "approvals", label: "Approvals", line: "New communities and discussions wait here until the team approves them. Members are told either way." },
  { value: "reports", label: "Reports", line: "Reports from BLong. You see the reported member or message only, never the rest of a chat. Suspend a member from their contact page." },
  { value: "communities", label: "Communities", line: "Communities members have created. Archiving hides one from Explore and stops new members; only the team can restore what the team archived." },
  { value: "discussions", label: "Discussions", line: "Discussions members have started. Archiving hides one and stops posting; only the team can restore what the team archived." },
  { value: "settings", label: "Settings", line: "Switch Communities and Discussions on or off (Coming soon) and choose what needs approval." },
];

/** Admin › Community: overview, approvals, reports, communities, discussions and settings. */
export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<{ show?: string; view?: string; status?: string; q?: string }> }) {
  const admin = await requireAdmin("community.view");
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.value === sp.view) ? (sp.view as View) : sp.show ? "reports" : "overview";
  const base = await currentAdminBase();
  const manage = can(admin, "community.manage");
  const waiting = (await blongPending()).length;
  const head = (
    <>
      <PageHeader title="Community" description={VIEWS.find((v) => v.value === view)!.line} />
      <ViewTabs base={base} view={view} waiting={waiting} />
    </>
  );
  if (view === "overview") return <>{head}<Overview base={base} /></>;
  if (view === "approvals") return <>{head}<Approvals base={base} manage={manage} /></>;
  if (view === "settings") return <>{head}<Settings manage={manage} /></>;
  if (view === "communities") return <>{head}<Communities manage={manage} base={base} status={sp.status} q={sp.q} /></>;
  if (view === "discussions") return <>{head}<Discussions manage={manage} base={base} status={sp.status} q={sp.q} /></>;
  return <>{head}<Reports raw={sp.show} base={base} manage={manage} /></>;
}

async function Reports({ raw, base, manage }: { raw?: string; base: string; manage: boolean }) {
  const show = raw === "all" || raw === "closed" ? raw : "open";
  const supabase = await createClient();
  let q = supabase.from("reports").select("id, reporter, kind, target_id, target_member, reason, details, excerpt, status, note, handled_at, created_at").order("created_at", { ascending: false }).limit(300);
  if (show === "open") q = q.eq("status", "open");
  if (show === "closed") q = q.neq("status", "open");
  const [{ data }, { count: openCount }] = await Promise.all([q, supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")]);
  const reports = (data ?? []) as Report[];
  const ids = [...new Set(reports.flatMap((r) => [r.reporter, r.target_member]).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await createServiceClient().from("profiles").select("id, full_name").in("id", ids);
    for (const p of (people ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, p.full_name || "Member");
  }
  const contact = (id: string | null) => (id ? `${base}/contacts/${slugOf(`m:${id}`)}` : null);

  return (
    <>
      <ChipLinks
        label="Show"
        items={[
          { href: `${base}/community?view=reports`, label: `Open${openCount ? ` (${openCount})` : ""}`, on: show === "open" },
          { href: `${base}/community?show=closed`, label: "Handled and dismissed", on: show === "closed" },
          { href: `${base}/community?show=all`, label: "All", on: show === "all" },
        ]}
      />
      {reports.length ? (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const target = contact(r.target_member);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={r.status === "open" ? "warn" : r.status === "handled" ? "ok" : "draft"}>{r.status === "open" ? "Open" : r.status === "handled" ? "Handled" : "Dismissed"}</StatusPill>
                  <b className="text-[14px]">{KIND[r.kind] ?? r.kind}</b>
                  <span className="text-[13px] text-faint">· {REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason} · {when(r.created_at)}</span>
                </div>
                <p className="text-[13.5px]">
                  <span className="text-faint">Reported: </span>
                  {target ? <Link href={target} className="font-bold text-link">{names.get(r.target_member!) ?? "Member"}</Link> : "Removed account"}
                  <span className="text-faint"> · by </span>
                  <Link href={contact(r.reporter)!} className="font-bold text-link">{names.get(r.reporter) ?? "Member"}</Link>
                </p>
                {r.excerpt ? <blockquote className="rounded-xl border border-line bg-hover px-3 py-2 text-[13.5px] whitespace-pre-wrap">{r.excerpt}</blockquote> : null}
                {r.details ? <p className="text-[13px]"><span className="text-faint">Reporter&apos;s note: </span>{r.details}</p> : null}
                {r.note && r.status !== "open" ? <p className="text-[12.5px] text-faint">Team note: {r.note}</p> : null}
                {manage ? <ReportActions id={r.id} status={r.status} /> : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState>{show === "open" ? "No open reports." : "No reports here."}</EmptyState>
      )}
    </>
  );
}

function ViewTabs({ base, view, waiting }: { base: string; view: View; waiting: number }) {
  return (
    <LinkTabs
      label="Community"
      value={view}
      hrefFor={(v) => (v === "overview" ? `${base}/community` : `${base}/community?view=${v}`)}
      items={VIEWS.map((v) => ({ value: v.value, label: v.label, count: v.value === "approvals" && waiting ? waiting : null }))}
    />
  );
}

const STATUS_LABEL: Record<string, string> = { active: "Active", open: "Open", closed: "Closed", archived: "Archived", pending: "Waiting for approval", declined: "Not approved" };
const statusPill = (s: string, team: boolean) => (
  <StatusPill tone={s === "active" || s === "open" ? "ok" : s === "pending" ? "warn" : s === "declined" ? "bad" : "draft"}>
    {s === "archived" && team ? "Archived by team" : STATUS_LABEL[s] ?? s}
  </StatusPill>
);

/** Status chips and a search box above the Communities and Discussions tables. */
function ListFilters({ base, view, status, q, options }: { base: string; view: string; status: string; q: string; options: string[] }) {
  const href = (st: string) => `${base}/community?${new URLSearchParams({ view, ...(st ? { status: st } : {}), ...(q ? { q } : {}) })}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipLinks label="Status" items={[{ href: href(""), label: "All", on: !status }, ...options.map((o) => ({ href: href(o), label: STATUS_LABEL[o], on: status === o }))]} />
      <form action={`${base}/community`} className="ml-auto" role="search">
        <input type="hidden" name="view" value={view} />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search by name" className="h-9 w-[220px] rounded-xl border border-line2 bg-card px-3 text-[13.5px] outline-none focus:border-primary" />
      </form>
    </div>
  );
}

type Row = { id: string; slug: string; name: string; type: string; visibility: string; status: string; archived_by_team: boolean; owner: string; created_at: string };

/** Every community, with its owner and size. Community managers archive or restore. */
async function Communities({ manage, base, status: rawStatus, q: rawQ }: { manage: boolean; base: string; status?: string; q?: string }) {
  const supabase = await createClient();
  const status = ["active", "pending", "declined", "archived"].includes(rawStatus ?? "") ? rawStatus! : "";
  const q = (rawQ ?? "").trim().slice(0, 80);
  let query = supabase.from("communities").select("id, slug, name, type, visibility, status, archived_by_team, owner, created_at").order("created_at", { ascending: false }).limit(500);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "")}%`);
  const { data } = await query;
  const rows = (data ?? []) as Row[];
  const svc = createServiceClient();
  const [{ data: people }, { data: members }] = await Promise.all([
    rows.length ? svc.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.owner))]) : Promise.resolve({ data: [] }),
    rows.length ? svc.from("community_members").select("community_id").eq("status", "active").in("community_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map(((people ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Member"]));
  const counts = new Map<string, number>();
  for (const m of (members ?? []) as { community_id: string }[]) counts.set(m.community_id, (counts.get(m.community_id) ?? 0) + 1);
  return (
    <>
      <ListFilters base={base} view="communities" status={status} q={q} options={["active", "pending", "declined", "archived"]} />
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="bg-hover text-[12px] text-faint">
              <tr><th className="px-3 py-2.5">Community</th><th className="px-3 py-2.5">Owner</th><th className="px-3 py-2.5">Members</th><th className="px-3 py-2.5">Privacy</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5"><b>{r.name}</b><span className="block text-[12px] text-faint">{r.type} · {when(r.created_at)}</span></td>
                  <td className="px-3 py-2.5"><Link href={`${base}/contacts/${slugOf(`m:${r.owner}`)}`} className="font-bold text-link">{names.get(r.owner) ?? "Member"}</Link></td>
                  <td className="px-3 py-2.5">{counts.get(r.id) ?? 0}</td>
                  <td className="px-3 py-2.5">{r.visibility === "private" ? "Private" : "Public"}</td>
                  <td className="px-3 py-2.5">{statusPill(r.status, r.archived_by_team)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.status === "pending" ? <Link href={`${base}/community?view=approvals`} className="font-bold text-link">Review</Link>
                      : manage && (r.status === "active" || r.status === "archived") ? <CommunityStatusButton id={r.id} status={r.status} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{status || q ? "No communities match." : "No communities yet."}</EmptyState>
      )}
    </>
  );
}

type Room = { id: string; title: string; category: string; privacy: string; status: string; archived_by_team: boolean; owner: string; community_id: string | null; member_limit: number; last_message_at: string | null; created_at: string };

/** Every discussion, with its host, community and size. Community managers archive or restore. Staff never read the messages here. */
async function Discussions({ manage, base, status: rawStatus, q: rawQ }: { manage: boolean; base: string; status?: string; q?: string }) {
  const supabase = await createClient();
  const status = ["open", "closed", "pending", "declined", "archived"].includes(rawStatus ?? "") ? rawStatus! : "";
  const q = (rawQ ?? "").trim().slice(0, 80);
  let query = supabase.from("discussions").select("id, title, category, privacy, status, archived_by_team, owner, community_id, member_limit, last_message_at, created_at").order("created_at", { ascending: false }).limit(500);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, "")}%`);
  const { data } = await query;
  const rows = (data ?? []) as Room[];
  const svc = createServiceClient();
  const [{ data: people }, { data: members }, { data: comms }] = await Promise.all([
    rows.length ? svc.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.owner))]) : Promise.resolve({ data: [] }),
    rows.length ? svc.from("discussion_members").select("discussion_id").eq("status", "active").in("discussion_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
    rows.some((r) => r.community_id) ? svc.from("communities").select("id, name").in("id", rows.flatMap((r) => (r.community_id ? [r.community_id] : []))) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map(((people ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Member"]));
  const communities = new Map(((comms ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const counts = new Map<string, number>();
  for (const m of (members ?? []) as { discussion_id: string }[]) counts.set(m.discussion_id, (counts.get(m.discussion_id) ?? 0) + 1);
  const privacy: Record<string, string> = { public: "Public", request: "Request to join", invite: "Invite only" };
  return (
    <>
      <ListFilters base={base} view="discussions" status={status} q={q} options={["open", "closed", "pending", "declined", "archived"]} />
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[820px] text-left text-[13.5px]">
            <thead className="bg-hover text-[12px] text-faint">
              <tr><th className="px-3 py-2.5">Discussion</th><th className="px-3 py-2.5">Host</th><th className="px-3 py-2.5">Members</th><th className="px-3 py-2.5">Who can join</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5"><b>{r.title}</b><span className="block text-[12px] text-faint">{r.category}{r.community_id ? ` · in ${communities.get(r.community_id) ?? "a community"}` : ""} · {when(r.created_at)}</span></td>
                  <td className="px-3 py-2.5"><Link href={`${base}/contacts/${slugOf(`m:${r.owner}`)}`} className="font-bold text-link">{names.get(r.owner) ?? "Member"}</Link></td>
                  <td className="px-3 py-2.5">{counts.get(r.id) ?? 0} of {r.member_limit}</td>
                  <td className="px-3 py-2.5">{privacy[r.privacy] ?? r.privacy}</td>
                  <td className="px-3 py-2.5">{statusPill(r.status, r.archived_by_team)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.status === "pending" ? <Link href={`${base}/community?view=approvals`} className="font-bold text-link">Review</Link>
                      : manage && r.status !== "declined" ? <DiscussionStatusButton id={r.id} archived={r.status === "archived"} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{status || q ? "No discussions match." : "No discussions yet."}</EmptyState>
      )}
    </>
  );
}
