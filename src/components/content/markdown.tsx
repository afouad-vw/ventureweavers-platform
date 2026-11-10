import Link from "next/link";
import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/content/markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        switch (x.t) {
          case "text":
            return <Fragment key={i}>{x.v}</Fragment>;
          case "strong":
            return <strong key={i} className="font-extrabold"><Inlines items={x.c} /></strong>;
          case "em":
            return <em key={i}><Inlines items={x.c} /></em>;
          case "code":
            return <code key={i} className="rounded bg-hover px-1 py-px text-[0.92em]">{x.v}</code>;
          case "link":
            return x.href.startsWith("/") ? (
              <Link key={i} href={x.href} className="font-bold text-link underline underline-offset-2"><Inlines items={x.c} /></Link>
            ) : (
              <a key={i} href={x.href} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-link underline underline-offset-2"><Inlines items={x.c} /></a>
            );
        }
      })}
    </>
  );
}

/** Blog body. Built from React elements only, so no HTML from the text ever reaches the page. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={className ?? "flex flex-col gap-3.5 text-[15px] leading-[1.7]"}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
            return <h2 key={i} className="mt-2 font-display text-[19px] font-semibold"><Inlines items={b.c} /></h2>;
          case "h3":
            return <h3 key={i} className="mt-1 text-[16px] font-extrabold"><Inlines items={b.c} /></h3>;
          case "p":
            return <p key={i}><Inlines items={b.c} /></p>;
          case "quote":
            return <blockquote key={i} className="border-l-[3px] border-teal pl-3.5 text-muted italic"><Inlines items={b.c} /></blockquote>;
          case "ul":
            return <ul key={i} className="flex list-disc flex-col gap-1 pl-5">{b.items.map((it, j) => <li key={j}><Inlines items={it} /></li>)}</ul>;
          case "ol":
            return <ol key={i} className="flex list-decimal flex-col gap-1 pl-5">{b.items.map((it, j) => <li key={j}><Inlines items={it} /></li>)}</ol>;
          case "hr":
            return <hr key={i} className="border-line" />;
        }
      })}
    </div>
  );
}
