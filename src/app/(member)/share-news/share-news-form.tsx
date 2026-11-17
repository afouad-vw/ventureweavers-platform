"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, ImagePlus, Trash2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { NEWS_LIMITS, NEWS_PLACES, NEWS_TYPES } from "@/lib/news/format";
import { putSigned } from "@/lib/put-signed";
import { checkUpload } from "@/lib/uploads";
import { finishNewsImage, startNewsImage, submitNews } from "./actions";

const OTHER = "__other";
const PLACE_LABEL: Record<string, string> = { Either: "Either is fine", Newsletter: "VW Newsletter", "VW Notes": "VW Notes" };

export function ShareNewsForm({ businesses, contact }: { businesses: string[]; contact: { name: string; email: string; phone: string } }) {
  const [biz, setBiz] = useState(businesses[0] ?? OTHER);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  if (done)
    return (
      <div className="flex flex-col items-start gap-3 py-2">
        <CheckCircle2 size={28} className="text-teal" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold">News sent</h2>
        <p className="text-[13.5px] text-muted">{done} You can follow it in My space › My news.</p>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/my-space?tab=news">My news</LinkButton>
          <Button variant="secondary" onClick={() => { setDone(null); setSummary(""); setDetails(""); setImage(null); }}>Share more news</Button>
        </div>
      </div>
    );

  const upload = (f: File) =>
    startUpload(async () => {
      setError(null);
      const bad = checkUpload("content-images", f.name, f.size);
      if (bad) return setError(bad);
      const s = await startNewsImage(f.name, f.size);
      if (!s.ok) return setError(s.error);
      if (!(await putSigned(s.url, s.contentType, f))) return setError("The upload didn't go through. Check your connection and try again.");
      const r = await finishNewsImage(s.path);
      if (!r.ok) return setError(r.error);
      setImage(r.url);
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (biz !== OTHER) fd.set("business_name", biz);
        if (image) fd.set("image_url", image);
        start(async () => {
          setError(null);
          const r = await submitNews(fd);
          if (r.ok) setDone(r.message ?? "Thanks!");
          else setError(r.error);
        });
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-[15px] font-semibold">The news</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Business"
            value={biz}
            onChange={(e) => setBiz(e.target.value)}
            options={[...businesses.map((b) => ({ value: b, label: b })), { value: OTHER, label: businesses.length ? "Another business" : "Type the business name" }]}
            hint={businesses.length ? undefined : "Add your businesses in your profile to pick them here."}
          />
          {biz === OTHER ? <TextField label="Business name" name="business_name" required maxLength={NEWS_LIMITS.business} /> : null}
          <SelectField label="Type of news" name="news_type" defaultValue="Funding round" options={NEWS_TYPES} />
          <TextField label="Date of the news" name="news_date" type="date" required defaultValue={today} />
        </div>
        <TextField label="Headline" name="headline" required maxLength={NEWS_LIMITS.headline} placeholder="e.g. Nile Pay raises a USD 2M seed round" />
        <TextArea
          label="Short summary"
          name="summary"
          required
          rows={2}
          maxLength={NEWS_LIMITS.summary}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          hint={`One or two sentences. ${summary.length}/${NEWS_LIMITS.summary}`}
        />
        <TextArea
          label="Full details"
          name="details"
          required
          rows={8}
          maxLength={NEWS_LIMITS.details}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          hint={`What happened, who was involved, numbers you're happy to share, and what's next. ${details.length.toLocaleString("en-US")}/${NEWS_LIMITS.details.toLocaleString("en-US")}`}
        />
        <TextField label="Link (optional)" name="link" placeholder="Press release, announcement or website" maxLength={500} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-muted">Image (optional)</span>
          {image ? (
            <div className="flex flex-wrap items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded preview, cropped */}
              <img src={image} alt="" className="aspect-video w-[240px] rounded-lg border border-line object-cover" />
              <Button variant="ghost" size="sm" onClick={() => setImage(null)}><Trash2 size={14} aria-hidden="true" />Remove</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" className="self-start" disabled={uploading} onClick={() => file.current?.click()}>
              <ImagePlus size={14} aria-hidden="true" />
              {uploading ? "Uploading…" : "Add an image"}
            </Button>
          )}
          <span className="text-[12px] text-faint">JPG, PNG or WebP up to 5 MB. A wide (16:9) photo or logo works best.</span>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
        </div>
        <SelectField label="Where would you like it?" name="preferred" defaultValue="Either" options={NEWS_PLACES.map((p) => ({ value: p, label: PLACE_LABEL[p] }))} hint="We decide the final placement and may edit the text." />
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="mb-2 font-display text-[15px] font-semibold">Who we contact with questions</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Name" name="contact_name" required defaultValue={contact.name} maxLength={120} />
          <TextField label="Email" name="contact_email" type="email" required defaultValue={contact.email} maxLength={200} />
          <TextField label="Mobile (optional)" name="contact_phone" defaultValue={contact.phone} maxLength={40} />
        </div>
      </fieldset>

      <label className="flex items-start gap-2.5 text-[13.5px]">
        <input type="checkbox" name="consent" required className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary" />
        <span>I confirm this news can be shared publicly, and that I have the right to share the text, link and image.</span>
      </label>
      {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
      <Button type="submit" className="self-start" disabled={pending || uploading}>{pending ? "Sending…" : "Send for review"}</Button>
    </form>
  );
}
