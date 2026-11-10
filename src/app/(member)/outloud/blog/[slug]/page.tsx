import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { CopyLinkButton, SaveButton } from "@/components/content/member-buttons";
import { Banner, type BannerChoice } from "@/components/ui/banner";
import { TagRow } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { blogBySlug, mySavedKeys } from "@/lib/content/queries";
import { formatDate } from "@/lib/events/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await blogBySlug((await params).slug);
  if (!post) return { title: "Blog" };
  return {
    title: post.title,
    description: post.summary || undefined,
    openGraph: { title: post.title, description: post.summary || undefined, type: "article", images: post.banner_url ? [post.banner_url] : undefined },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await blogBySlug((await params).slug);
  if (!post) notFound();
  const member = await getMember();
  const saved = member ? await mySavedKeys() : new Set<string>();
  const byKarim = post.author === "Karim Hemdan";
  const byBoth = post.author.includes("&");

  return (
    <>
      <Link href="/outloud?tab=blog" className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-link hover:underline">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the blog
      </Link>
      <article className="mx-auto flex w-full max-w-[720px] flex-col gap-3.5">
        <div className="overflow-hidden rounded-xl">
          <Banner src={post.banner_url} choice={post.banner as BannerChoice} thread="Outloud" height={220} chip={post.category} />
        </div>
        {post.tags.length ? <TagRow tags={post.tags} /> : null}
        <h1 className="font-display text-[26px] leading-tight font-semibold desk:text-[30px]">{post.title}</h1>
        <div className="flex items-center gap-2">
          {byBoth ? (
            <span className="flex -space-x-2">
              <Image src="/images/ahmed.jpg" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full border-2 border-card object-cover" />
              <Image src="/images/karim.jpg" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full border-2 border-card object-cover" />
            </span>
          ) : (
            <Image src={byKarim ? "/images/karim.jpg" : "/images/ahmed.jpg"} alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full object-cover" />
          )}
          <span className="text-[13px] text-faint">
            <b className="text-fg">{post.author}</b> · {formatDate(post.published_on + "T12:00:00Z")} · {post.read_time} read
          </span>
        </div>
        {post.summary ? <p className="text-[16px] leading-relaxed text-muted">{post.summary}</p> : null}
        <Markdown source={post.body} />
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-3.5">
          <SaveButton type="blog" id={post.id} saved={saved.has(`blog:${post.id}`)} signedIn={!!member} />
          <CopyLinkButton />
        </div>
      </article>
    </>
  );
}
