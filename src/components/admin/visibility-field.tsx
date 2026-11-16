"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, Search, UserPlus, X } from "lucide-react";
import { loadPersonOptions } from "@/app/admin/(console)/access-actions";
import { SelectField, Toggle } from "@/components/ui/field";
import { isEmail, VISIBILITIES, type AccessPerson, type PersonOption, type Visibility } from "@/lib/access";
import { initialsOf } from "@/lib/initials";

/**
 * Visibility (Public / Private) and, when private, the people who can see it, picked from Contacts
 * (or added by email). Sends `visibility`, `access` (JSON) and `access_notify` with the editor's form.
 */
export function VisibilityField({ initial, people: initialPeople }: { initial: Visibility; people: AccessPerson[] }) {
  const [visibility, setVisibility] = useState<Visibility>(initial);
  const [people, setPeople] = useState<AccessPerson[]>(initialPeople);
  const [options, setOptions] = useState<PersonOption[] | null>(null);
  const [q, setQ] = useState("");
  const [loading, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const load = () => {
    if (options || loading) return;
    start(async () => {
      try {
        setOptions(await loadPersonOptions());
      } catch {
        setFailed(true);
        setOptions([]);
      }
    });
  };

  const key = (p: { member_id?: string; email?: string }) => p.member_id ?? `e:${p.email}`;
  const chosen = useMemo(() => new Set(people.map(key)), [people]);
  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () => (options ?? []).filter((o) => !chosen.has(key(o)) && (!needle || `${o.name} ${o.sub}`.toLowerCase().includes(needle))).slice(0, 8),
    [options, chosen, needle],
  );
  const add = (p: AccessPerson) => {
    setPeople((list) => (list.some((x) => key(x) === key(p)) ? list : [...list, p]));
    setQ("");
  };
  const typedEmail = isEmail(q) && !chosen.has(`e:${q.trim().toLowerCase()}`) && !(options ?? []).some((o) => o.email === q.trim().toLowerCase());

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-[12.5px] font-bold text-muted">Who can see it</legend>
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="access" value={JSON.stringify(people)} />
      <SelectField label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} options={VISIBILITIES} />
      {visibility === "private" ? (
        <>
          <p className="flex items-start gap-1.5 text-[12.5px] text-muted">
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            Only the people below can see it, anywhere in the app. Contacts who aren&apos;t members yet see it once they join with that email.
          </p>
          {people.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="People who can see it">
              {people.map((p) => (
                <li key={key(p)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line2 bg-card pr-1 pl-1 text-[12.5px]">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-mint text-[10px] font-extrabold text-ink">{initialsOf(p.name || p.email || "?")}</span>
                  <span className="max-w-[180px] truncate font-bold">{p.name || p.email}</span>
                  {!p.member_id ? <span className="text-faint">invite</span> : null}
                  <button type="button" onClick={() => setPeople((list) => list.filter((x) => key(x) !== key(p)))} aria-label={`Remove ${p.name || p.email}`} className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-faint hover:bg-hover hover:text-fg">
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] font-bold text-bad-fg">No one added yet, so no member can see it.</p>
          )}
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" aria-hidden="true" />
            <label htmlFor="access-q" className="sr-only">Add people from Contacts</label>
            <input
              id="access-q"
              value={q}
              onFocus={load}
              onChange={(e) => {
                load();
                setQ(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[0]) add(matches[0]);
                  else if (typedEmail) add({ email: q.trim().toLowerCase(), name: q.trim() });
                }
              }}
              placeholder={loading ? "Loading contacts…" : "Add people: type a name or email"}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-line2 bg-card/80 pr-2.5 pl-8 text-[13.5px] placeholder:text-faint focus:border-primary focus:outline-none desk:h-9"
            />
          </div>
          {needle && (matches.length || typedEmail) ? (
            <ul className="flex max-h-56 flex-col overflow-y-auto rounded-lg border border-line bg-card" role="listbox" aria-label="Matching contacts">
              {matches.map((o) => (
                <li key={key(o)}>
                  <button type="button" onClick={() => add({ member_id: o.member_id, email: o.member_id ? undefined : o.email, name: o.name })} className="flex min-h-10 w-full cursor-pointer flex-col items-start px-3 py-1.5 text-left hover:bg-hover">
                    <b className="text-[13px]">{o.name}</b>
                    <span className="text-[11.5px] text-faint">{o.sub}</span>
                  </button>
                </li>
              ))}
              {typedEmail ? (
                <li>
                  <button type="button" onClick={() => add({ email: q.trim().toLowerCase(), name: q.trim() })} className="flex min-h-10 w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-hover">
                    <UserPlus size={14} aria-hidden="true" />
                    Invite <b>{q.trim()}</b> by email
                  </button>
                </li>
              ) : null}
            </ul>
          ) : needle && options && !loading ? (
            <p className="text-[12.5px] text-faint">{failed ? "Couldn't load contacts. Type an email to invite someone." : "No match. Type a full email address to invite someone new."}</p>
          ) : null}
          <Toggle label="Tell newly added people (notification and email)" name="access_notify" defaultChecked />
        </>
      ) : null}
    </fieldset>
  );
}
