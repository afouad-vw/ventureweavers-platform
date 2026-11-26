"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DISCUSSION_CATEGORIES, DISCUSSION_LIMITS, ROOM_PRIVACY, type DiscussionInput } from "@/lib/blong/discussions";
import { saveDiscussion } from "@/app/(member)/blong/discussions/actions";

/** Start a discussion (optionally inside a community you're in), or edit one. */
export function DiscussionForm({ id, slug, initial, communities = [], community }: {
  id?: string; slug?: string; initial?: DiscussionInput; communities?: { id: string; name: string }[]; community?: string | null;
}) {
  const [privacy, setPrivacy] = useState(initial?.privacy ?? "public");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        fd.set("privacy", privacy);
        start(async () => {
          const r = await saveDiscussion(id ?? null, fd);
          if (!r.ok) return setError(r.error);
          toast(id ? "Changes saved" : "Discussion created");
          router.push(`/blong/discussions/${id ? slug : r.value}`, { scroll: false });
          router.refresh();
        });
      }}
    >
      <TextField label="Title or topic" name="title" required minLength={3} maxLength={DISCUSSION_LIMITS.title} defaultValue={initial?.title} placeholder="e.g. Pricing a B2B product in Egypt" />
      <TextArea label="Description (optional)" name="description" rows={3} maxLength={DISCUSSION_LIMITS.description} value={description} onChange={(e) => setDescription(e.target.value)}
        hint={`What you'd like to talk about and who should join · ${description.length}/${DISCUSSION_LIMITS.description}`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Category" name="category" required defaultValue={initial?.category ?? ""} options={[{ value: "", label: "Choose a category" }, ...DISCUSSION_CATEGORIES]} />
        {id ? null : (
          <SelectField
            label="In a community (optional)"
            name="community"
            defaultValue={community ?? ""}
            options={[{ value: "", label: "Stand-alone" }, ...communities.map((c) => ({ value: c.id, label: c.name }))]}
            hint="Inside a community, only its members can find it."
          />
        )}
        <TextField label="Tags" name="tags" defaultValue={(initial?.tags ?? []).join(", ")} hint="Up to 8, separated by commas." placeholder="Pricing, B2B, SaaS" />
        <TextField label="Member limit" name="limit" type="number" required min={DISCUSSION_LIMITS.minMembers} max={DISCUSSION_LIMITS.maxMembers} defaultValue={initial?.limit ?? 50} hint="2 to 500 people." />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12.5px] font-bold text-muted">Who can join</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROOM_PRIVACY.map((o) => (
            <label key={o.value} className={cn("bl-opt flex cursor-pointer flex-col gap-1 rounded-2xl border p-3.5", privacy === o.value && "on")}>
              <span className="flex items-center gap-2 text-[14px] font-extrabold">
                <input type="radio" name="privacy-choice" checked={privacy === o.value} onChange={() => setPrivacy(o.value)} className="accent-[#8DBF2E]" />
                {o.label}
              </span>
              <span className="text-[12.5px] text-faint">{o.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p className="text-[13px] font-bold text-bad-fg" role="alert">{error}</p> : null}
      <p className="text-[12px] text-faint">Discussions follow the <a href="/terms" target="_blank" rel="noreferrer" className="font-bold text-link">community guidelines</a>.</p>
      <span className="flex gap-2">
        <Button type="submit" className="bl-follow" disabled={pending}>{pending ? "Saving…" : id ? "Save changes" : "Start discussion"}</Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </span>
    </form>
  );
}
