"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ACTIVITY_KINDS, BIO_MAX, LINKS_MAX, type Visibility } from "@/lib/blong/format";
import { savePrivacy } from "@/app/(member)/blong/actions";

export type PrivacyValues = { visibility: Visibility; bio: string; links: { label: string; url: string }[]; activity: string[] };

/** Profile settings › Privacy: who can follow and message you, what they see, and your card's bio and links. */
export function PrivacyForm({ initial }: { initial: PrivacyValues }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = <K extends keyof PrivacyValues>(k: K, val: PrivacyValues[K]) => setV((o) => ({ ...o, [k]: val }));
  const options: { value: Visibility; title: string; text: string; Icon: typeof Lock }[] = [
    { value: "private", title: "Private", text: "People ask to follow you. Until you accept, they see only your name, photo and roles, and can't message you.", Icon: Lock },
    { value: "public", title: "Public", text: "Anyone in BLong can follow and message you, and sees your bio, businesses, links and the VW activity you choose below.", Icon: Globe },
  ];

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await savePrivacy(v);
          if (!r.ok) return setError(r.error);
          toast("Privacy saved");
          router.refresh();
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[12.5px] font-bold text-muted">Your account</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(({ value, title, text, Icon }) => (
            <label key={value} className={cn("bl-opt flex cursor-pointer flex-col gap-1 rounded-2xl border p-3.5", v.visibility === value && "on")}>
              <span className="flex items-center gap-2 text-[14px] font-extrabold">
                <input type="radio" name="visibility" value={value} checked={v.visibility === value} onChange={() => set("visibility", value)} className="accent-[#8DBF2E]" />
                <Icon size={15} aria-hidden="true" />{title}
              </span>
              <span className="text-[12.5px] text-faint">{text}</span>
            </label>
          ))}
        </div>
        {initial.visibility === "private" && v.visibility === "public" ? <p className="text-[12.5px] text-faint">Going Public accepts every follow request waiting for you.</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[12.5px] font-bold text-muted">VW activity people can see</legend>
        {ACTIVITY_KINDS.map((a) => (
          <label key={a.key} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[13.5px]">
            {a.label}
            <input
              type="checkbox"
              role="switch"
              className="bl-switch"
              checked={v.activity.includes(a.key)}
              onChange={(e) => set("activity", e.target.checked ? [...v.activity, a.key] : v.activity.filter((x) => x !== a.key))}
            />
          </label>
        ))}
        <p className="mt-1.5 text-[12px] text-faint">Never shown: payments, requests to the team, client projects, private items, your email and phone.</p>
      </fieldset>

      <TextArea label="Short bio" hint={`${v.bio.length}/${BIO_MAX}`} maxLength={BIO_MAX} value={v.bio} onChange={(e) => set("bio", e.target.value)} placeholder="What you work on and what you'd like to talk about" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] font-bold text-muted">Links on your card</legend>
        <p className="-mt-1 text-[12px] text-faint">Your LinkedIn from About you shows too. Add a website, X, Instagram or a portfolio.</p>
        {v.links.map((l, i) => (
          <div key={i} className="flex items-end gap-2">
            <TextField label="Name" className="w-[34%]" value={l.label} maxLength={40} onChange={(e) => set("links", v.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Website" />
            <TextField label="Address" className="flex-1" value={l.url} maxLength={200} onChange={(e) => set("links", v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="example.com" />
            <Button variant="ghost" aria-label={`Remove ${l.label || "link"}`} onClick={() => set("links", v.links.filter((_, j) => j !== i))}><Trash2 size={15} aria-hidden="true" /></Button>
          </div>
        ))}
        {v.links.length < LINKS_MAX ? (
          <Button variant="secondary" className="self-start" onClick={() => set("links", [...v.links, { label: "", url: "" }])}><Plus size={15} aria-hidden="true" />Add a link</Button>
        ) : null}
      </fieldset>

      {error ? <p className="text-[13px] font-bold text-bad-fg" role="alert">{error}</p> : null}
      <Button type="submit" className="self-start" disabled={pending}>Save changes</Button>
    </form>
  );
}
