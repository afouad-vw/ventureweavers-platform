"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Globe, ImagePlus, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { COMMUNITY_LIMITS, COMMUNITY_TYPES, type CommunityInput } from "@/lib/blong/communities";
import { putSigned } from "@/lib/put-signed";
import { ROLES } from "@/lib/profile/options";
import { checkUpload } from "@/lib/uploads";
import { finishCover, saveCommunity, startCover } from "@/app/(member)/blong/communities/actions";

/** Create a community, or edit one (owners and admins). */
export function CommunityForm({ id, slug, initial }: { id?: string; slug?: string; initial?: CommunityInput }) {
  const [v, setV] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    type: initial?.type ?? "",
    topics: (initial?.topics ?? []).join(", "),
    audience: initial?.audience ?? [],
    visibility: initial?.visibility ?? "public",
    cover: initial?.cover ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));

  const upload = (f: File) =>
    startUpload(async () => {
      setError(null);
      const bad = checkUpload("content-images", f.name, f.size);
      if (bad) return setError(bad);
      const s = await startCover(f.name, f.size);
      if (!s.ok) return setError(s.error);
      if (!(await putSigned(s.url, s.contentType, f))) return setError("The upload didn't go through. Check your connection and try again.");
      const done = await finishCover(s.path);
      if (!done.ok) return setError(done.error);
      set("cover", done.url);
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        fd.set("visibility", v.visibility);
        if (v.cover) fd.set("cover", v.cover);
        for (const a of v.audience) fd.append("audience", a);
        start(async () => {
          const r = await saveCommunity(id ?? null, fd, initial?.cover ?? null);
          if (!r.ok) return setError(r.error);
          toast(id ? "Changes saved" : "Community created");
          router.push(`/blong/communities/${id ? slug : r.value}`, { scroll: false });
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" name="name" required minLength={3} maxLength={COMMUNITY_LIMITS.name} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Fintech founders" />
        <SelectField label="Type" name="type" required value={v.type} onChange={(e) => set("type", e.target.value)} options={[{ value: "", label: "Choose a type" }, ...COMMUNITY_TYPES]} />
      </div>
      <TextArea label="Description" name="description" rows={4} required maxLength={COMMUNITY_LIMITS.description} hint={`What it's for and who should join · ${v.description.length}/${COMMUNITY_LIMITS.description}`} value={v.description} onChange={(e) => set("description", e.target.value)} />
      <TextField label="Topics" name="topics" hint="Up to 8, separated by commas." value={v.topics} onChange={(e) => set("topics", e.target.value)} placeholder="Fundraising, Hiring, Product" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Who it&apos;s for (optional)</legend>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => {
            const on = v.audience.includes(r);
            return (
              <button key={r} type="button" aria-pressed={on} className="bl-pill cursor-pointer" aria-current={on ? "true" : undefined} onClick={() => set("audience", on ? v.audience.filter((x) => x !== r) : [...v.audience, r])}>
                {r}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Privacy</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { value: "public", title: "Public", text: "Anyone can find it, see its members and join.", Icon: Globe },
            { value: "private", title: "Private", text: "Anyone can find it. People ask to join and admins accept, or you invite them.", Icon: Lock },
          ] as const).map(({ value, title, text, Icon }) => (
            <label key={value} className={cn("bl-opt flex cursor-pointer flex-col gap-1 rounded-2xl border p-3.5", v.visibility === value && "on")}>
              <span className="flex items-center gap-2 text-[14px] font-extrabold">
                <input type="radio" name="vis" checked={v.visibility === value} onChange={() => set("visibility", value)} className="accent-[#7C5CE0]" />
                <Icon size={15} aria-hidden="true" />{title}
              </span>
              <span className="text-[12.5px] text-faint">{text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-bold text-muted">Cover image (optional)</span>
        {v.cover ? (
          <span className="relative w-full max-w-[420px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded preview, cropped */}
            <img src={v.cover} alt="" className="aspect-[16/7] w-full rounded-xl border border-line object-cover" />
            <button type="button" aria-label="Remove the cover" className="absolute top-2 right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink/70 text-white" onClick={() => set("cover", null)}><X size={15} aria-hidden="true" /></button>
          </span>
        ) : null}
        <Button variant="secondary" size="sm" className="self-start" disabled={uploading} onClick={() => file.current?.click()}>
          <ImagePlus size={14} aria-hidden="true" />{uploading ? "Uploading…" : v.cover ? "Change image" : "Add an image"}
        </Button>
        <span className="text-[12px] text-faint">JPG, PNG or WebP up to 5 MB, wide (about 16:7). Without one, we use a photo.</span>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      </div>

      {error ? <p className="text-[13px] font-bold text-bad-fg" role="alert">{error}</p> : null}
      <p className="text-[12px] text-faint">Communities follow the <a href="/terms" target="_blank" rel="noreferrer" className="font-bold text-link">community guidelines</a>.</p>
      <span className="flex gap-2">
        <Button type="submit" className="bl-follow" disabled={pending || uploading}>{pending ? "Saving…" : id ? "Save changes" : "Create community"}</Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </span>
    </form>
  );
}
