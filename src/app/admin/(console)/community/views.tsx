import Link from "next/link";
import { Clock, Flag, MessagesSquare, ShieldCheck, UserPlus, Users } from "lucide-react";
import { WaitlistBadge } from "@/components/admin/waitlist-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/tag";
import { slugOf } from "@/lib/contacts/slug";
import { BLONG_SECTION_IDS, BLONG_SECTION_TITLE, MOD_RULE_LABEL, type BlongSection } from "@/lib/blong/format";
import { blongAdminSettings, blongHeld, blongModStats, blongPending, blongStats, blongWatch } from "@/lib/blong/queries";
import { adminWaitlists } from "@/lib/waitlist-server";
import { HeldButtons, ReviewButtons, RulesForm, SettingSwitch } from "./controls";

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const n = (x: number | null | undefined) => new Intl.NumberFormat("en-GB").format(x ?? 0);
const sum = (r: Record<string, number> | null, keys: string[]) => keys.reduce((a, k) => a + (r?.[k] ?? 0), 0);

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <Card className="gap-1">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-faint"><Icon size={14} aria-hidden="true" />{label}</span>
      <b className="font-display text-[28px] leading-none font-semibold">{value}</b>
      {sub ? <span className="text-[12px] text-faint">{sub}</span> : null}
    </Card>
  );
}

/** Admin › Community › Overview: counts only. Staff never read chats here. */
export async function Overview({ base }: { base: string }) {
  const [s, mod] = await Promise.all([blongStats(), blongModStats()]);
  if (!s) return <EmptyState>Numbers show here once BLong is connected.</EmptyState>;
  const max = Math.max(1, ...s.daily.map((d) => d.messages + d.joins));
  const maxActive = Math.max(1, ...s.daily.map((d) => d.active));
  return (
    <div className="flex flex-col gap-4">
      {s.pending ? (
        <Link href={`${base}/community?view=approvals`} className="bl-review warn flex items-center gap-2 rounded-2xl border px-4 py-3 text-[13.5px] font-bold">
          <Clock size={16} aria-hidden="true" />{s.pending} waiting for approval. Review them
        </Link>
      ) : null}
      {mod && mod.held_now + mod.hidden_now ? (
        <Link href={`${base}/community?view=held`} className="bl-review warn flex items-center gap-2 rounded-2xl border px-4 py-3 text-[13.5px] font-bold">
          <ShieldCheck size={16} aria-hidden="true" />{mod.held_now + mod.hidden_now} {mod.held_now + mod.hidden_now === 1 ? "message is" : "messages are"} held or hidden. Review them
        </Link>
      ) : null}
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        <Tile icon={Users} label="Members on BLong" value={n(s.members)} sub={`${n(s.public)} Public · ${n(s.members - s.public)} Private`} />
        <Tile icon={UserPlus} label="Active members" value={n(s.active_7)} sub={`last 7 days · ${n(s.active_30)} in 30 days`} />
        <Tile icon={Users} label="Communities" value={n(sum(s.communities, ["active"]))} sub={`${n(s.communities_30)} new in 30 days · ${n(sum(s.communities, ["archived"]))} archived`} />
        <Tile icon={MessagesSquare} label="Discussions" value={n(sum(s.discussions, ["open", "closed"]))} sub={`${n(s.discussions_30)} new in 30 days · ${n(sum(s.discussions, ["archived"]))} archived`} />
        <Tile icon={MessagesSquare} label="Room messages" value={n(s.room_messages_30)} sub={`last 30 days · ${n(s.room_messages)} in all`} />
        <Tile icon={MessagesSquare} label="Member messages" value={n(s.member_messages_30)} sub="last 30 days (count only)" />
        <Tile icon={UserPlus} label="Joins and follows" value={n(s.joins_30 + s.follows_30)} sub={`last 30 days · ${n(s.follows)} follows in all`} />
        <Tile icon={Flag} label="Reports open" value={n(s.reports_open)} sub={`${n(s.reports_handled_30)} handled in 30 days${s.handle_hours != null ? ` · ${s.handle_hours} h on average` : ""}`} />
        {mod?.posts_30 !== undefined ? <Tile icon={MessagesSquare} label="Posts and comments" value={n((mod.posts_30 ?? 0) + (mod.comments_30 ?? 0))} sub={`last 30 days · ${n(mod.posts_30)} posts, ${n(mod.comments_30)} comments`} /> : null}
        {mod?.likes_30 !== undefined ? <Tile icon={UserPlus} label="Likes, shares and saves" value={n((mod.likes_30 ?? 0) + (mod.shares_30 ?? 0) + (mod.saves_30 ?? 0))} sub={`last 30 days · ${n(mod.likes_30)} likes, ${n(mod.shares_30)} shares, ${n(mod.saves_30)} saves`} /> : null}
        {mod ? <Tile icon={ShieldCheck} label="Caught by the rules" value={n(mod.held_30)} sub={`held in 30 days · ${n(mod.hidden_30)} hidden after reports · ${n(mod.removed_30)} removed`} /> : null}
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold">Last 30 days</h2>
          <span className="flex gap-3 text-[12px] text-faint">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#8DBF2E]" />Messages</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#29be9c]" />Joins</span>
            <span className="inline-flex items-center gap-1"><i className="h-0.5 w-3 bg-[#f2c27a]" />Active members</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 600 160" className="h-[180px] w-full min-w-[480px]" role="img" aria-label="Messages, joins and active members per day for the last 30 days">
            {s.daily.map((d, i) => {
              const x = 6 + i * 19.6, hm = (d.messages / max) * 130, hj = (d.joins / max) * 130;
              return (
                <g key={d.day}>
                  <title>{`${d.day}: ${d.messages} messages, ${d.joins} joins, ${d.active} active`}</title>
                  <rect x={x} y={140 - hm} width={12} height={hm} rx={2} fill="#8DBF2E" />
                  <rect x={x} y={140 - hm - hj} width={12} height={hj} rx={2} fill="#29be9c" />
                </g>
              );
            })}
            <polyline fill="none" stroke="#f2c27a" strokeWidth={2} points={s.daily.map((d, i) => `${12 + i * 19.6},${140 - (d.active / maxActive) * 130}`).join(" ")} />
            <line x1={0} x2={600} y1={140.5} y2={140.5} stroke="currentColor" strokeOpacity={0.2} />
            <text x={4} y={156} fontSize={10} fill="currentColor" opacity={0.6}>{s.daily[0]?.day.slice(5)}</text>
            <text x={596} y={156} fontSize={10} fill="currentColor" opacity={0.6} textAnchor="end">{s.daily.at(-1)?.day.slice(5)}</text>
          </svg>
        </div>
      </Card>

      <div className="grid gap-4 desk:grid-cols-2">
        <TopList title="Most active communities" note="Joins plus messages in their rooms, last 30 days" rows={s.top_communities} />
        <TopList title="Most active discussions" note="Messages, last 30 days" rows={s.top_discussions} />
      </div>
    </div>
  );
}

function TopList({ title, note, rows }: { title: string; note: string; rows: { name: string; slug: string; status: string; members: number; score: number }[] }) {
  return (
    <Card>
      <h2 className="text-[15px] font-bold">{title}</h2>
      <p className="-mt-1 text-[12px] text-faint">{note}</p>
      {rows.length ? (
        <ol className="flex flex-col divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.slug} className="flex items-center gap-3 py-2 text-[13.5px]">
              <span className="w-5 text-faint">{i + 1}</span>
              <b className="min-w-0 flex-1 truncate">{r.name}</b>
              {r.status === "archived" ? <StatusPill tone="draft">Archived</StatusPill> : null}
              <span className="text-[12px] text-faint">{n(r.members)} in</span>
              <b className="w-10 text-right">{n(r.score)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[13px] text-faint">Nothing yet.</p>
      )}
    </Card>
  );
}

/** New communities and discussions waiting for the team. */
export async function Approvals({ base, manage }: { base: string; manage: boolean }) {
  const items = await blongPending();
  if (!items.length) return <EmptyState>Nothing waiting for approval.</EmptyState>;
  const privacy: Record<string, string> = { public: "Public", private: "Private", request: "Request to join", invite: "Invite only" };
  return (
    <div className="flex flex-col gap-3">
      {items.map((x) => (
        <Card key={x.id}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="warn">{x.resubmitted ? "Resubmitted" : "New"}</StatusPill>
            <b className="text-[14px]">{x.kind === "community" ? "Community" : "Discussion"}</b>
            <span className="text-[13px] text-faint">· {x.label} · {privacy[x.privacy] ?? x.privacy}{x.community ? ` · in ${x.community}` : ""} · {when(x.created_at)}</span>
          </div>
          <div className="flex gap-3">
            {x.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- member upload, cropped
              <img src={x.cover_url} alt="" className="h-16 w-28 flex-none rounded-lg object-cover" />
            ) : null}
            <div className="min-w-0">
              <h3 className="font-display text-[18px] leading-tight font-semibold">{x.name}</h3>
              <p className="text-[13.5px] whitespace-pre-line">{x.description || <span className="text-faint">No description.</span>}</p>
            </div>
          </div>
          <p className="text-[13px]"><span className="text-faint">By </span><Link href={`${base}/contacts/${slugOf(`m:${x.owner_id}`)}`} className="font-bold text-link">{x.owner_name}</Link></p>
          {manage ? <ReviewButtons kind={x.kind} id={x.id} name={x.name} /> : null}
        </Card>
      ))}
    </div>
  );
}

/** Section switches, approval and the sections' Notify me lists. */
export async function Settings({ manage }: { manage: boolean }) {
  const s = await blongAdminSettings();
  if (!s) return <EmptyState>Settings show here once BLong is connected.</EmptyState>;
  const ids = Object.values(BLONG_SECTION_IDS);
  const lists = await adminWaitlists("blong_section", ids);
  const sections: BlongSection[] = ["communities", "discussions"];
  return (
    <div className="grid gap-4 desk:grid-cols-2">
      <Card>
        <h2 className="text-[15px] font-bold">Sections</h2>
        <p className="-mt-1 text-[12.5px] text-faint">A switched-off section shows Coming soon and Notify me to members. Nothing in it can be seen, joined or posted, and everything comes back as it was when you switch it on.</p>
        <SettingSwitch name="communities_on" label="Communities" hint="Includes the discussions that sit inside communities." value={s.communities_on} manage={manage}
          confirmOff="Members won't see any community, or the discussions inside them, until you switch Communities back on." />
        <SettingSwitch name="discussions_on" label="Discussions" hint="Every discussion, inside a community or not." value={s.discussions_on} manage={manage}
          confirmOff="Members won't see any discussion until you switch Discussions back on." />
        <div className="mt-2 flex flex-col gap-1.5">
          {sections.map((k) => (
            <div key={k} className="flex items-center justify-between gap-2 text-[13px]">
              <span>Notify me list: {BLONG_SECTION_TITLE[k]} ({(lists[BLONG_SECTION_IDS[k]] ?? []).length})</span>
              <WaitlistBadge type="blong_section" id={BLONG_SECTION_IDS[k]} title={BLONG_SECTION_TITLE[k]} people={lists[BLONG_SECTION_IDS[k]] ?? []} comingSoon />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="inline-flex items-center gap-1.5 text-[15px] font-bold"><ShieldCheck size={16} aria-hidden="true" />Approval</h2>
        <p className="-mt-1 text-[12.5px] text-faint">New ones wait in Approvals and only their creator sees them until you approve. Both partners get an email for each new one.</p>
        <SettingSwitch name="approve_communities" label="New communities need approval" hint="Turning this off doesn't publish the ones already waiting." value={s.approve_communities} manage={manage} />
        <SettingSwitch name="approve_discussions" label="New discussions need approval" hint="Turning this off doesn't publish the ones already waiting." value={s.approve_discussions} manage={manage} />
        <p className="mt-2 text-[12px] text-faint">Last changed {when(s.updated_at)}.</p>
      </Card>
      <Card className="desk:col-span-2">
        <h2 className="inline-flex items-center gap-1.5 text-[15px] font-bold"><ShieldCheck size={16} aria-hidden="true" />Automatic moderation</h2>
        <p className="-mt-1 text-[12.5px] text-faint">Checked every time a member posts in a discussion, sends a message or names a community or discussion. Held messages wait in the Held tab and only their author sees them.</p>
        <RulesForm rules={s} manage={manage} />
      </Card>
    </div>
  );
}

/** Messages the rules held, or that reports hid: only these are readable by staff. Plus members caught often. */
export async function Held({ base, manage }: { base: string; manage: boolean }) {
  const [items, watch] = await Promise.all([blongHeld(), blongWatch()]);
  return (
    <div className="grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-3">
        {items.length ? items.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={m.mod_status === "held" ? "warn" : "bad"}>{m.mod_status === "held" ? "Held" : "Hidden"}</StatusPill>
              <b className="text-[14px]">{MOD_RULE_LABEL[m.mod_rule ?? ""] ?? "Review"}</b>
              <span className="text-[13px] text-faint">· {m.kind === "post" ? "Post" : m.kind === "comment" ? "Comment" : "Discussion message"} in {m.room_title} · {when(m.created_at)}{m.reports ? ` · ${m.reports} open ${m.reports === 1 ? "report" : "reports"}` : ""}</span>
            </div>
            <blockquote className="rounded-xl border border-line bg-hover px-3 py-2 text-[13.5px] whitespace-pre-wrap">{m.body}</blockquote>
            <p className="text-[13px]"><span className="text-faint">By </span><Link href={`${base}/contacts/${slugOf(`m:${m.author_id}`)}`} className="font-bold text-link">{m.author_name}</Link></p>
            {manage ? <HeldButtons kind={m.kind} id={m.id} /> : null}
          </Card>
        )) : <EmptyState>Nothing held or hidden.</EmptyState>}
      </div>
      <Card>
        <h2 className="text-[15px] font-bold">Watch list</h2>
        <p className="-mt-1 text-[12px] text-faint">Members caught by the rules five or more times in the last 7 days. Nothing happens automatically: warn them, or suspend from their contact page.</p>
        {watch.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {watch.map((w) => (
              <li key={w.member_id} className="flex items-center justify-between gap-2 py-2 text-[13.5px]">
                <Link href={`${base}/contacts/${slugOf(`m:${w.member_id}`)}`} className="font-bold text-link">{w.name}</Link>
                <span className="text-[12px] text-faint">{w.caught} times</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-faint">Nobody right now.</p>}
      </Card>
    </div>
  );
}
