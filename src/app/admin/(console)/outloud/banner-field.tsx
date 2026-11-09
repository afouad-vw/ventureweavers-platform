"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadEventBanner } from "./actions";

const MAX_BYTES = 5 * 1024 * 1024;
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

/** Banner upload for the event editor: size guide, checks, preview, and a hidden field with the saved address. */
export function BannerField({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState<string | null>(initial);
  const [note, setNote] = useState<{ tone: "warn" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setNote(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setNote({ tone: "bad", text: "Use a JPG, PNG or WebP image." });
    if (file.size > MAX_BYTES) return setNote({ tone: "bad", text: "The image is larger than 5 MB. Export a smaller JPG or WebP." });
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
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadEventBanner(fd);
      if (r.ok) {
        setUrl(r.url);
        setNote(warn.length ? { tone: "warn", text: `Uploaded. ${warn.join(" ")}` } : null);
      } else setNote({ tone: "bad", text: r.error });
      if (input.current) input.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-muted">Banner image</span>
      <input type="hidden" name="banner_url" value={url ?? ""} />
      {url ? (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-hover">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-uploaded file */}
          <img src={url} alt="Banner preview" className="h-full w-full object-cover" />
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
        Recommended <b>1600 × 900 px</b> (16:9), at least 1200 × 675. JPG, PNG or WebP, up to 5 MB. Keep faces and text near the centre: cards crop the edges. Without an upload, the photo or pattern below is used.
      </span>
      {note ? <span role={note.tone === "bad" ? "alert" : "status"} className={note.tone === "bad" ? "text-[12.5px] font-bold text-bad-fg" : "text-[12.5px] font-bold text-warn-fg"}>{note.text}</span> : null}
    </div>
  );
}
