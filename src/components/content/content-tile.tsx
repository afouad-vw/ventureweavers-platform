import Image from "next/image";
import { Play } from "lucide-react";
import { youtubeThumb } from "@/lib/content/format";
import type { ContentItem } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";
import { PreviewImage } from "./preview-image";

/** One Short or episode: the post's preview image, then its title and date. Opens the post. */
export function ContentTile({ c, wide = false }: { c: ContentItem; wide?: boolean }) {
  const soon = c.status === "scheduled" || !c.url;
  const img = c.image_url || c.thumb_url || youtubeThumb(c.url);
  const when = formatDate(c.publish_on + "T12:00:00Z");
  const inner = (
    <>
      <span className={`relative block overflow-hidden rounded-[16px] bg-gradient-to-br from-deep to-ink ${c.format === "Short" ? "aspect-[9/16]" : "aspect-video"}`}>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/85" aria-hidden="true">
          <Image src="/brand/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl opacity-90" />
          <span className="text-[11px] font-extrabold tracking-[1.4px] uppercase">{soon ? "Coming soon" : c.platform}</span>
        </span>
        {img ? <PreviewImage src={img} /> : null}
        <span className="absolute top-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-extrabold tracking-[1.2px] text-white uppercase backdrop-blur-md">{c.platform}</span>
        {!soon ? (
          <span className="absolute right-2 bottom-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-depth transition-transform group-hover:scale-110 motion-reduce:transition-none" aria-hidden="true">
            <Play size={15} className="ml-0.5" fill="currentColor" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-0.5 px-0.5">
        <b className="line-clamp-2 text-[14px] leading-snug font-extrabold">{c.title}</b>
        <span className="text-[12px] text-faint">{soon ? `Coming ${when}` : when}</span>
      </span>
    </>
  );
  const cls = `group flex flex-col gap-2 rounded-[18px] ${wide ? "w-[260px] shrink-0 snap-start sm:w-[300px]" : "min-w-0"}`;
  return soon ? (
    <div className={cls}>{inner}</div>
  ) : (
    <a href={c.url!} target="_blank" rel="noopener noreferrer" className={`${cls} hover:[&_b]:underline`} aria-label={`${c.title} on ${c.platform}`}>{inner}</a>
  );
}

