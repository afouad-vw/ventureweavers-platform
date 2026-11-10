"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { finishAvatarUpload, removeAvatar, startAvatarUpload } from "@/app/(member)/avatar-actions";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/lib/initials";
import { putSigned } from "@/lib/put-signed";
import { checkUpload } from "@/lib/uploads";

/** Profile photo: upload (JPG, PNG or WebP up to 2 MB, always shown as a cropped circle) or remove. */
export function AvatarField({ name, initial }: { name: string; initial: string | null }) {
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const upload = (file: File) =>
    start(async () => {
      setError(null);
      const bad = checkUpload("avatars", file.name, file.size);
      if (bad) return setError(bad);
      const s = await startAvatarUpload(file.name, file.size);
      if (!s.ok) return setError(s.error);
      if (!(await putSigned(s.url, s.contentType, file))) return setError("The upload didn't go through. Check your connection and try again.");
      const f = await finishAvatarUpload(s.path);
      if (!f.ok) return setError(f.error);
      setUrl(f.url);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-muted">Profile photo (optional)</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-display text-[20px] font-bold text-white">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- member photo, always cropped to a circle
            <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initialsOf(name || "Member")
          )}
        </span>
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          <Camera size={14} aria-hidden="true" />
          {pending ? "Uploading…" : url ? "Change photo" : "Add photo"}
        </Button>
        {url ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { const r = await removeAvatar(); if (r.ok) setUrl(null); else setError(r.error); })}>
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </Button>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
      </div>
      <span className="text-[12px] text-faint">JPG, PNG or WebP, up to 2 MB. A square photo works best.</span>
      {error ? <p role="alert" className="text-[12.5px] font-bold text-bad-fg">{error}</p> : null}
    </div>
  );
}
