import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductBanner, ProductLogo } from "@/components/eureka/product-logo";
import { Tilt } from "@/components/ui/tilt";
import { WeaveHero } from "@/components/ui/weave";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { getMember } from "@/lib/auth/guards";
import { myWaitlist, qqStages } from "@/lib/brickr/queries";
import { PRODUCT_INFO, PRODUCTS, productHref } from "@/lib/eureka";

export const metadata: Metadata = { title: "Eureka" };

export default async function EurekaPage() {
  const member = await getMember();
  const rows = await Promise.all(
    PRODUCTS.map(async (p) => {
      const [stages, mine] = await Promise.all([qqStages(p), member ? myWaitlist(member.id, p) : null]);
      return { info: PRODUCT_INFO[p], stages, mine };
    }),
  );

  return (
    <>
      <WeaveHero
        id="eureka-weave"
        above={<ThreadTag thread="QuidQuo" label="Eureka · Products lab" />}
        title="Eureka"
        description="Our products lab. We build AI products for the people we work with, in the open. Follow each one and be first in when it opens."
      />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {rows.map(({ info, stages, mine }) => {
          const nowIdx = stages.findIndex((s) => s.progress < 100);
          const current = stages[nowIdx < 0 ? stages.length - 1 : nowIdx];
          return (
            <Tilt key={info.key} className="flex min-w-0 rounded-[20px]">
              <article className="glass vw-surface flex min-w-0 flex-1 flex-col border">
                <ProductBanner product={info.key} className="flex h-[150px] items-center justify-center rounded-t-[19px]">
                  <ProductLogo product={info.key} height={46} />
                  {mine ? <span className="absolute top-3 right-3"><StatusPill tone="ok">On the waitlist</StatusPill></span> : null}
                </ProductBanner>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <h2 className="text-[15px] font-extrabold">
                    {info.name}
                    <span className="font-semibold text-faint"> · {info.tagline}</span>
                  </h2>
                  <p className="line-clamp-2 text-[13px] text-muted">{info.description}</p>
                  {stages.length ? (
                    <div className="flex gap-1.5" aria-label={current ? `Now: ${current.name}` : undefined}>
                      {stages.slice(0, 6).map((s) => (
                        <div key={s.id} className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, s.progress))}%`, backgroundColor: info.brand.accent }} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1.5">
                    <span className="text-[12.5px] text-faint">{current ? `Now: ${current.name}` : "In development"}</span>
                    <Link href={productHref(info.key)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold hover:brightness-110" style={{ backgroundColor: info.brand.accent, color: info.brand.accentText }}>
                      {mine ? "Follow progress" : "View details"}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </Tilt>
          );
        })}
      </div>
    </>
  );
}
