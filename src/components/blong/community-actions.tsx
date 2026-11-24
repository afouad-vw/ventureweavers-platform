"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Archive, Check, Crown, Flag, LogOut, Search, Shield, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { roleLabel, type CommunityPage, type CommunityPerson } from "@/lib/blong/communities";
import { REPORT_REASONS } from "@/lib/blong/format";
import { reportContent } from "@/app/(member)/blong/actions";
import {
  deleteCommunity, inviteToCommunity, joinCommunity, leaveCommunity, removeFromCommunity, respondToJoin, searchMembers,
  setCommunityRole, setCommunityStatus, transferCommunity,
} from "@/app/(member)/blong/communities/actions";
import {
  inviteToDiscussion, removeFromDiscussion, respondToDiscussionJoin, setDiscussionRole, transferDiscussion,
} from "@/app/(member)/blong/discussions/actions";

/** The same member tools serve communities and discussions. */
const OPS = {
  community: { respond: respondToJoin, setRole: setCommunityRole, remove: removeFromCommunity, transfer: transferCommunity, invite: inviteToCommunity },
  discussion: { respond: respondToDiscussionJoin, setRole: setDiscussionRole, remove: removeFromDiscussion, transfer: transferDiscussion, invite: inviteToDiscussion },
} as const;
type Kind = keyof typeof OPS;
import { MemberAvatar } from "./member-avatar";

/** Join / Ask to join / Accept invite / Requested / Leave, from the viewer's place in the community. */
export function JoinControls({ c }: { c: Pick<CommunityPage, "id" | "name" | "visibility" | "my_role" | "my_status" | "status"> }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; value?: unknown }>, done: (v: unknown) => string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "Something went wrong.");
      toast(done(r.value));
      router.refresh();
    });
  if (c.status !== "active") return null;
  if (c.my_status === "active") {
    if (c.my_role === "owner") return null;
    return (
      <>
        <Button variant="secondary" disabled={pending} onClick={() => setConfirm(true)}><LogOut size={15} aria-hidden="true" />Leave</Button>
        <Modal open={confirm} onClose={() => setConfirm(false)} title={`Leave ${c.name}?`} footer={<>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={() => { setConfirm(false); run(() => leaveCommunity(c.id), () => `You left ${c.name}`); }}>Leave</Button>
        </>}>
          <p className="text-[13.5px]">{c.visibility === "private" ? "To come back, you'll need to ask again or be invited." : "You can join again at any time."}</p>
        </Modal>
      </>
    );
  }
  if (c.my_status === "requested") {
    return <Button variant="secondary" disabled={pending} title="Take back your request" onClick={() => run(() => leaveCommunity(c.id), () => "Request taken back")}>Requested</Button>;
  }
  if (c.my_status === "invited") {
    return (
      <span className="flex gap-2">
        <Button className="bl-follow" disabled={pending} onClick={() => run(() => joinCommunity(c.id), () => `Welcome to ${c.name}`)}><Check size={15} aria-hidden="true" />Accept invite</Button>
        <Button variant="secondary" disabled={pending} onClick={() => run(() => leaveCommunity(c.id), () => "Invite declined")}>Decline</Button>
      </span>
    );
  }
  return (
    <Button className="bl-follow" disabled={pending} onClick={() => run(() => joinCommunity(c.id), (v) => (v === "requested" ? "Request sent to the admins" : `Welcome to ${c.name}`))}>
      {c.visibility === "private" ? "Ask to join" : "Join community"}
    </Button>
  );
}

/** The members list; owners and admins also see requests and invites and manage roles. */
export function PeopleList({ c, people, me, kind = "community" }: { c: Pick<CommunityPage, "id" | "name" | "my_role">; people: CommunityPerson[]; me: string; kind?: Kind }) {
  const ops = OPS[kind];
  const [pending, start] = useTransition();
  const [handOver, setHandOver] = useState<CommunityPerson | null>(null);
  const toast = useToast();
  const router = useRouter();
  const admin = c.my_role === "owner" || c.my_role === "admin";
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "Something went wrong.");
      toast(msg);
      router.refresh();
    });
  const requests = people.filter((p) => p.status === "requested");
  const invited = people.filter((p) => p.status === "invited");
  const active = people.filter((p) => p.status === "active");
  const row = (p: CommunityPerson, actions: React.ReactNode) => (
    <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
      <Link href={`/blong/members/${p.id}`} scroll={false} className="flex min-w-0 flex-1 items-center gap-2.5">
        <MemberAvatar id={p.id} name={p.name} src={p.avatar_url} size={36} />
        <span className="min-w-0">
          <b className="block truncate text-[14px]">{p.name}{p.id === me ? " (you)" : ""}</b>
          <span className="block truncate text-[12px] text-faint">{p.roles.slice(0, 2).join(", ")}</span>
        </span>
      </Link>
      {actions}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      {admin && requests.length ? (
        <section className="flex flex-col gap-1">
          <h3 className="bl-sec">Asking to join · {requests.length}</h3>
          <ul className="divide-y divide-line">
            {requests.map((p) => row(p, (
              <span className="flex gap-1.5">
                <Button size="sm" className="bl-follow" disabled={pending} onClick={() => act(() => ops.respond(c.id, p.id, true), `${p.name} joined`)}><Check size={14} aria-hidden="true" />Accept</Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => ops.respond(c.id, p.id, false), "Declined")}><X size={14} aria-hidden="true" />Decline</Button>
              </span>
            )))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-1">
        <h3 className="bl-sec">Members · {active.length}</h3>
        <ul className="divide-y divide-line">
          {active.map((p) => row(p, (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={`bl-role ${p.role !== "member" ? "on" : ""}`}>{p.role === "owner" ? <Crown size={11} aria-hidden="true" /> : p.role === "admin" ? <Shield size={11} aria-hidden="true" /> : null}{roleLabel(p.role)}</span>
              {admin && p.role !== "owner" && p.id !== me ? (
                <>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => ops.setRole(c.id, p.id, p.role === "admin" ? "member" : "admin"), p.role === "admin" ? `${p.name} is a member again` : `${p.name} is now an admin`)}>
                    {p.role === "admin" ? "Make member" : "Make admin"}
                  </Button>
                  {c.my_role === "owner" || p.role === "member" ? (
                    <Button size="sm" variant="ghost" aria-label={`Remove ${p.name}`} disabled={pending} onClick={() => act(() => ops.remove(c.id, p.id), `${p.name} removed`)}><UserMinus size={14} aria-hidden="true" /></Button>
                  ) : null}
                  {c.my_role === "owner" ? (
                    <Button size="sm" variant="ghost" aria-label={`Hand ${c.name} to ${p.name}`} title="Make owner" disabled={pending} onClick={() => setHandOver(p)}><Crown size={14} aria-hidden="true" /></Button>
                  ) : null}
                </>
              ) : null}
            </span>
          )))}
        </ul>
      </section>

      {admin && invited.length ? (
        <section className="flex flex-col gap-1">
          <h3 className="bl-sec">Invited · {invited.length}</h3>
          <ul className="divide-y divide-line">
            {invited.map((p) => row(p, (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => ops.remove(c.id, p.id), "Invite taken back")}>Take back</Button>
            )))}
          </ul>
        </section>
      ) : null}

      <Modal open={!!handOver} onClose={() => setHandOver(null)} title={`Make ${handOver?.name ?? ""} the owner?`} footer={<>
        <Button variant="secondary" onClick={() => setHandOver(null)}>Cancel</Button>
        <Button disabled={pending} onClick={() => { const p = handOver!; setHandOver(null); act(() => ops.transfer(c.id, p.id), `${p.name} now owns ${c.name}`); }}>Make owner</Button>
      </>}>
        <p className="text-[13.5px]">{handOver?.name} becomes the owner of {c.name}. You stay as an admin and can then leave if you want.</p>
      </Modal>
    </div>
  );
}

/** Owners and admins invite members by name. */
export function InviteBox({ id, kind = "community" }: { id: string; kind?: Kind }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; avatar_url: string | null; roles: string[] }[]>([]);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  useEffect(() => {
    const t = setTimeout(() => { void searchMembers(q).then(setFound).catch(() => setFound([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex h-10 items-center gap-2 rounded-xl border border-line2 bg-card/70 px-3 text-faint focus-within:border-primary">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Find a member to invite</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member by name or business" className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint" />
      </label>
      {found.length ? (
        <ul className="flex flex-col">
          {found.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 py-1.5">
              <MemberAvatar id={p.id} name={p.name} src={p.avatar_url} size={32} />
              <span className="min-w-0 flex-1"><b className="block truncate text-[13.5px]">{p.name}</b><span className="block truncate text-[12px] text-faint">{p.roles.slice(0, 2).join(", ")}</span></span>
              {sent[p.id] ? (
                <span className="text-[12.5px] font-bold text-faint">{sent[p.id]}</span>
              ) : (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
                  const r = await OPS[kind].invite(id, p.id);
                  if (!r.ok) return toast(r.error);
                  setSent((s) => ({ ...s, [p.id]: r.value === "active" ? "Already in" : r.value === "invited" ? "Invited" : "Invited" }));
                })}><UserPlus size={14} aria-hidden="true" />Invite</Button>
              )}
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 ? <p className="text-[12.5px] text-faint">No members match.</p> : null}
    </div>
  );
}

/** Archive, restore and delete (owner), and Report (anyone else). */
export function CommunityOwnerZone({ c }: { c: Pick<CommunityPage, "id" | "name" | "status" | "my_role" | "archived_by_team"> }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "delete" | "archive">(null);
  const toast = useToast();
  const router = useRouter();
  if (c.my_role !== "owner") return null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, go?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "Something went wrong.");
      toast(msg);
      if (go) router.push(go, { scroll: false });
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {c.status === "pending" || c.status === "declined" ? null : c.status === "active" ? (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => setConfirm("archive")}><Archive size={14} aria-hidden="true" />Archive</Button>
      ) : c.archived_by_team ? null : (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setCommunityStatus(c.id, "active"), "Community restored")}>Restore</Button>
      )}
      <Button variant="danger" size="sm" disabled={pending} onClick={() => setConfirm("delete")}><Trash2 size={14} aria-hidden="true" />Delete</Button>
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "delete" ? `Delete ${c.name}?` : `Archive ${c.name}?`} footer={<>
        <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
        {confirm === "delete" ? (
          <Button variant="danger" disabled={pending} onClick={() => { setConfirm(null); run(() => deleteCommunity(c.id), "Community deleted", "/blong/communities?tab=owned"); }}>Delete for good</Button>
        ) : (
          <Button disabled={pending} onClick={() => { setConfirm(null); run(() => setCommunityStatus(c.id, "archived"), "Community archived"); }}>Archive</Button>
        )}
      </>}>
        <p className="text-[13.5px]">
          {confirm === "delete"
            ? "This removes the community and its member list for everyone. It can't be undone. Archiving keeps it and lets you restore it later."
            : "It leaves Explore and members can't join. Members keep their place, and you can restore it any time."}
        </p>
      </Modal>
    </div>
  );
}

export function ReportCommunity({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Flag size={14} aria-hidden="true" />Report</Button>
      <Modal open={open} onClose={() => setOpen(false)} eyebrow="Report" title={`Report ${name}`} footer={<>
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={pending || !reason} onClick={() => start(async () => {
          const r = await reportContent("community", id, reason, details);
          if (!r.ok) return toast(r.error);
          toast("Thanks. The VentureWeavers team will look into it.");
          setOpen(false);
        })}>Send report</Button>
      </>}>
        <p className="text-[13px] text-faint">The owner isn&apos;t told who reported it.</p>
        <SelectField label="What's wrong?" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Choose a reason" }, ...REPORT_REASONS]} />
        <TextArea label="Anything else we should know? (optional)" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
      </Modal>
    </>
  );
}
