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
import { ReportActions } from "./report-actions";

export const metadata: Metadata = { title: "Community" };

type Report = {
  id: string; reporter: string; kind: string; target_id: string; target_member: string | null; reason: string;
  details: string | null; excerpt: string | null; status: "open" | "handled" | "dismissed"; note: string | null; handled_at: string | null; created_at: string;
};

const KIND: Record<string, string> = { member: "Member", message: "Member message", community: "Community", discussion: "Discussion", room_message: "Room message" };
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** BLong reports. Staff see the reported member or message only, never the rest of a chat. */
export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const admin = await requireAdmin("community.view");
  const { show: raw } = await searchParams;
  const show = raw === "all" || raw === "closed" ? raw : "open";
  const supabase = await createClient();
  let q = supabase.from("reports").select("id, reporter, kind, target_id, target_member, reason, details, excerpt, status, note, handled_at, created_at").order("created_at", { ascending: false }).limit(300);
  if (show === "open") q = q.eq("status", "open");
  if (show === "closed") q = q.neq("status", "open");
  const [{ data }, base, { count: openCount }] = await Promise.all([q, currentAdminBase(), supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")]);
  const reports = (data ?? []) as Report[];
  const ids = [...new Set(reports.flatMap((r) => [r.reporter, r.target_member]).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await createServiceClient().from("profiles").select("id, full_name").in("id", ids);
    for (const p of (people ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, p.full_name || "Member");
  }
  const contact = (id: string | null) => (id ? `${base}/contacts/${slugOf(`m:${id}`)}` : null);
  const manage = can(admin, "community.manage");

  return (
    <>
      <PageHeader title="Community" description="Reports from BLong. You see the reported member or message only, never the rest of a chat. Suspend a member from their contact page." />
      <ChipLinks
        label="Show"
        items={[
          { href: `${base}/community`, label: `Open${openCount ? ` (${openCount})` : ""}`, on: show === "open" },
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
