"use client";

import { useState } from "react";
import { Mail, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { ConfirmDelete, EditorDrawer, IconBtn, TableBox, td, useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { relativeWhen } from "@/lib/content/format";
import { AREAS, cleanPerms, describePerms, PRESETS, type Level, type Perm } from "@/lib/auth/permissions";
import { initialsOf } from "@/lib/initials";
import { addTeamMember, pauseTeamMember, removeTeamMember, resendTeamInvite, updateTeamMember } from "./actions";

export type TeamRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  isSuper: boolean;
  perms: string[];
  paused: boolean;
  pending: boolean;
  lastSignIn: string | null;
  isMe: boolean;
};

const suggestUsername = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^\w\s.-]/g, "").trim().split(/\s+/).slice(0, 2).join(".").replace(/[^a-z0-9._-]/g, "").slice(0, 32);

export function TeamBoard({ rows }: { rows: TeamRow[] }) {
  const [edit, setEdit] = useState<TeamRow | "new" | null>(null);
  const [del, setDel] = useState<TeamRow | null>(null);
  const r = useRunner();
  const e = edit && edit !== "new" ? edit : null;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { r.setError(null); setEdit("new"); }}>
          <Plus size={15} aria-hidden="true" />
          Add team member
        </Button>
      </div>

      <TableBox minWidth={860} head={["Person", "Access", "Status", "Last sign-in", ""]}>
        {rows.map((m) => (
          <tr key={m.id} className="border-b border-line align-top last:border-b-0">
            <td className={td}>
              <span className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[12px] font-bold text-white">{initialsOf(m.name)}</span>
                <span className="min-w-0">
                  <b className="block">{m.name}{m.isMe ? <span className="font-normal text-faint"> (you)</span> : null}</b>
                  <span className="text-[12px] text-faint">{m.username}{m.email ? ` · ${m.email}` : ""}</span>
                </span>
              </span>
            </td>
            <td className={`${td} max-w-[360px] text-muted`}>{m.isSuper ? <b className="text-fg">Super admin · full access</b> : describePerms(m.perms)}</td>
            <td className={td}>
              {m.isSuper ? <StatusPill tone="ok">Active</StatusPill> : m.paused ? <StatusPill tone="draft">Paused</StatusPill> : m.pending ? <StatusPill tone="warn">Invite sent</StatusPill> : <StatusPill tone="ok">Active</StatusPill>}
            </td>
            <td className={`${td} text-muted`}>{m.lastSignIn ? relativeWhen(m.lastSignIn) : "Never"}</td>
            <td className={`${td} whitespace-nowrap text-right`}>
              {m.isSuper ? (
                <span className="text-[12px] text-faint">Fixed</span>
              ) : (
                <span className="inline-flex gap-0.5">
                  {m.pending && !m.paused ? <IconBtn label={`Resend invite to ${m.name}`} onClick={() => r.run(() => resendTeamInvite(m.id))}><Mail size={15} aria-hidden="true" /></IconBtn> : null}
                  <IconBtn label={`Edit ${m.name}'s access`} onClick={() => { r.setError(null); setEdit(m); }}><Pencil size={15} aria-hidden="true" /></IconBtn>
                  <IconBtn label={m.paused ? `Restore ${m.name}'s access` : `Pause ${m.name}'s access`} onClick={() => r.run(() => pauseTeamMember(m.id, !m.paused))}>
                    {m.paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                  </IconBtn>
                  <IconBtn label={`Remove ${m.name}`} onClick={() => setDel(m)}><Trash2 size={15} aria-hidden="true" /></IconBtn>
                </span>
              )}
            </td>
          </tr>
        ))}
      </TableBox>

      <EditorDrawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        eyebrow="Team & access"
        title={e ? `Edit ${e.name}` : "Add team member"}
        pending={r.pending}
        error={r.error}
        formKey={e?.id ?? "new"}
        wide
        onSubmit={(fd) => r.run(() => (e ? updateTeamMember(fd) : addTeamMember(fd)), () => setEdit(null))}
      >
        <MemberFields row={e} />
      </EditorDrawer>

      <ConfirmDelete
        name={del?.name}
        open={del !== null}
        onClose={() => setDel(null)}
        pending={r.pending}
        note="They're signed out and can't sign in again. What they did stays in the activity history."
        onConfirm={() => del && r.run(() => removeTeamMember(del.id), () => setDel(null))}
      />
    </>
  );
}

function MemberFields({ row }: { row: TeamRow | null }) {
  const [name, setName] = useState(row?.name ?? "");
  const [username, setUsername] = useState(row?.username ?? "");
  const [touched, setTouched] = useState(Boolean(row));
  const [perms, setPerms] = useState<Perm[]>(cleanPerms(row?.perms ?? []));
  const levelOf = (key: string): Level | "none" => (perms.includes(`${key}.manage` as Perm) ? "manage" : perms.includes(`${key}.view` as Perm) ? "view" : "none");
  const setLevel = (key: string, level: Level | "none") =>
    setPerms(cleanPerms([...perms.filter((p) => !p.startsWith(`${key}.`)), ...(level === "none" ? [] : [`${key}.${level}`])]));

  return (
    <>
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      {perms.map((p) => <input key={p} type="hidden" name="perms" value={p} />)}
      <TextField
        label="Full name"
        name="name"
        value={name}
        onChange={(ev) => {
          setName(ev.target.value);
          if (!touched) setUsername(suggestUsername(ev.target.value));
        }}
        required
        maxLength={80}
      />
      {row ? (
        <TextField label="Username" value={row.username} readOnly disabled hint="Usernames can't change." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Username" name="username" value={username} onChange={(ev) => { setTouched(true); setUsername(ev.target.value.toLowerCase()); }} required maxLength={32} hint="Used to sign in, e.g. sara.ali" />
          <TextField label="Work email" name="email" type="email" required maxLength={200} hint="Gets the invite to set a password (2-hour link)." />
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-[12.5px] font-bold text-muted">Start from a preset</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Chip key={p.key} pressed={p.perms.length === perms.length && p.perms.every((x) => perms.includes(x))} onClick={() => setPerms(cleanPerms(p.perms))}>{p.label}</Chip>
          ))}
          <Chip pressed={false} onClick={() => setPerms([])}>Clear</Chip>
        </div>
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className="pb-1.5 text-[12.5px] font-bold text-muted">What they can open</legend>
        <div className="flex flex-col rounded-xl border border-line">
          {AREAS.map((a) => {
            const current = levelOf(a.key);
            const options: (Level | "none")[] = ["none", ...(a.levels as readonly Level[])];
            return (
              <div key={a.key} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 last:border-b-0">
                <span className="min-w-[180px] flex-1">
                  <b className="block text-[13.5px]">{a.label}</b>
                  <span className="text-[12px] text-faint">{a.hint}</span>
                </span>
                <span role="radiogroup" aria-label={a.label} className="inline-flex rounded-lg border border-line2 bg-card p-0.5">
                  {options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={current === o}
                      onClick={() => setLevel(a.key, o)}
                      className={cn(
                        "h-8 min-w-[64px] cursor-pointer rounded-md px-2.5 text-[12.5px] font-bold",
                        current === o ? (o === "none" ? "bg-hover text-fg" : "bg-primary text-white") : "text-faint hover:text-fg",
                      )}
                    >
                      {o === "none" ? "No access" : o === "view" ? "View" : a.levels.length === 1 ? "Yes" : "Manage"}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <span className="pt-1.5 text-[12px] text-faint">Settings (bank details, Calendly, inboxes) and this Team page stay with Ahmed and Karim.</span>
      </fieldset>
    </>
  );
}
