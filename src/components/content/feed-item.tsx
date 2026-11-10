import Image from "next/image";
import Link from "next/link";
import { BookOpen, Briefcase, Cpu, GraduationCap, Mail, Mic, type LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { ThreadTag, type TagTone } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { isExternal, isSpace, relativeWhen } from "@/lib/content/format";
import type { PostRow } from "@/lib/content/queries";
import { SaveButton } from "./member-buttons";

const photos: Record<string, string> = {
  Stage: "/images/stage.jpg",
  Round: "/images/round.jpg",
  Room: "/images/room.jpg",
  Audience: "/images/hands.jpg",
  Show: "/images/show.jpg",
  Crowd: "/images/crowd.jpg",
};
const tile: Record<TagTone, string> = {
  Outloud: "bg-out-bg text-out-fg",
  TVS: "bg-tvs-bg text-tvs-fg",
  BRICKR: "bg-brk-bg text-brk-fg",
  QuidQuo: "bg-qq-bg text-qq-fg",
  House: "bg-house-bg text-house-fg",
};
const icon: Record<TagTone, LucideIcon> = { Outloud: Mic, TVS: GraduationCap, BRICKR: Briefcase, QuidQuo: Cpu, House: Mail };

export function PostLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  ) : (
    <Link href={href} className={className}>{children}</Link>
  );
}

/** One update in the Home feed: picture or space icon, space tag, kind and time, title, text, button, save. */
export function FeedItem({ post, saved, signedIn }: { post: PostRow; saved: boolean; signedIn: boolean }) {
  const space: TagTone = isSpace(post.space) ? post.space : "House";
  const src = post.image_url || (post.banner ? photos[post.banner] : undefined);
  const Icon = space === "House" && post.kind.toLowerCase().includes("library") ? BookOpen : icon[space];
  const href = post.link_url;
  return (
    <article className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
      <div className={cn("relative hidden h-[86px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] sm:flex", !src && tile[space])}>
        {src ? <Image src={src} alt="" fill sizes="120px" className="object-cover" /> : <Icon size={26} strokeWidth={1.6} aria-hidden="true" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <ThreadTag thread={space} />
          <span className="text-[12.5px] text-faint">{post.kind} · {relativeWhen(post.published_at)}</span>
        </div>
        {href ? (
          <PostLink href={href} className="text-[15px] font-extrabold hover:underline">{post.title}</PostLink>
        ) : (
          <span className="text-[15px] font-extrabold">{post.title}</span>
        )}
        {post.body ? <p className="line-clamp-3 text-[13.5px] whitespace-pre-line text-muted">{post.body}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {href ? <PostLink href={href} className={buttonClass("secondary", "sm")}>{post.link_label || "Open"}</PostLink> : null}
          <SaveButton type="post" id={post.id} saved={saved} signedIn={signedIn} />
        </div>
      </div>
    </article>
  );
}
