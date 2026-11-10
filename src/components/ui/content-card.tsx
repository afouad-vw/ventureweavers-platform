import { Banner, type BannerChoice } from "./banner";
import { Tilt } from "./tilt";
import { TagRow, type TagTone } from "./tag";

/**
 * The standard card for programs, masterclasses, services and blog posts:
 * banner, title, short description, tags, and a footer with meta text and a CTA.
 */
export function ContentCard({
  thread,
  banner = "Pattern",
  bannerSrc,
  bannerLabel,
  bannerChip,
  bannerChipRight,
  title,
  subtitle,
  description,
  tags = [],
  tagsBefore,
  meta,
  cta,
}: {
  thread: TagTone;
  banner?: BannerChoice;
  bannerSrc?: string | null;
  bannerLabel?: string;
  bannerChip?: React.ReactNode;
  bannerChipRight?: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  tags?: string[];
  tagsBefore?: React.ReactNode;
  meta?: React.ReactNode;
  cta?: React.ReactNode;
}) {
  return (
    <Tilt className="flex min-w-0 rounded-2xl">
    <article className="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
      <div className="vw-zoom overflow-hidden">
        <Banner src={bannerSrc} choice={banner} thread={thread} label={bannerLabel} chip={bannerChip} chipRight={bannerChipRight} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="text-[15px] font-extrabold">
          {title}
          {subtitle ? <span className="font-semibold text-faint"> · {subtitle}</span> : null}
        </h3>
        {description ? <p className="line-clamp-2 text-[13px] text-muted">{description}</p> : null}
        {tags.length || tagsBefore ? <TagRow tags={tags} before={tagsBefore} /> : null}
        {meta || cta ? (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1.5">
            <span className="text-[12.5px] text-faint">{meta}</span>
            {cta}
          </div>
        ) : null}
      </div>
    </article>
    </Tilt>
  );
}
