"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "./upload";

const MIN_W = 1200;
const MIN_H = 675;

function readSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("unreadable"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Image upload for editors: size guide, checks, preview, and a hidden field with the saved address.
 * The file goes straight to storage, then the server checks it really is an image.
 */
export function ImageField({
  name,
  initial,
  target = "content-images",
  label = "Banner image",
  fallbackNote = "Without an upload, the photo or pattern below is used.",
}: {
  name: string;
  initial: string | null;
  target?: "event-banners" | "content-images";
  label?: string;
  fallbackNote?: string;
}) {
  const [url, setUrl] = useState<string | null>(initial);
  const [note, setNote] = useState<{ tone: "warn" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setNote(null);
    let size: { w: number; h: number };
    try {
      size = await readSize(file);
    } catch {
      return setNote({ tone: "bad", text: "That file couldn't be read as an image." });
    }
    const warn: string[] = [];
    if (size.w < MIN_W || size.h < MIN_H) warn.push(`It's ${size.w} × ${size.h} px, smaller than ${MIN_W} × ${MIN_H}, so it may look soft.`);
    const ratio = size.w / size.h;
    if (ratio < 1.5 || ratio > 2.1) warn.push("It isn't close to 16:9, so the edges will be cropped.");
    start(async () => {
      const r = await uploadFile(target, file);
      if (r.ok && r.file.url) {
        setUrl(r.file.url);
        setNote(warn.length ? { tone: "warn", text: `Uploaded. ${warn.join(" ")}` } : null);
      } else setNote({ tone: "bad", text: r.ok ? "The upload didn't go through." : r.error });
      if (input.current) input.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-muted">{label}</span>
      <input type="hidden" name={name} value={url ?? ""} />
      {url ? (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-hover">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-uploaded file */}
          <img src={url} alt="Preview" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          <ImagePlus size={14} aria-hidden="true" />
          {pending ? "Uploading…" : url ? "Replace image" : "Upload image"}
        </Button>
        {url ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setUrl(null); setNote(null); }}>
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pick(e.target.files?.[0])} />
      <span className="text-[12px] font-normal text-faint">
        Recommended <b>1600 × 900 px</b> (16:9), at least 1200 × 675. JPG, PNG or WebP, up to 5 MB. Keep faces and text near the centre: cards crop the edges. {fallbackNote}
      </span>
      {note ? <span role={note.tone === "bad" ? "alert" : "status"} className={note.tone === "bad" ? "text-[12.5px] font-bold text-bad-fg" : "text-[12.5px] font-bold text-warn-fg"}>{note.text}</span> : null}
    </div>
  );
}
