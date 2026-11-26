import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WeaveHero } from "@/components/ui/weave";
import { CopyInviteButton, JoinedMark, LeaveWaitlistButton, WaitlistForm } from "@/components/brickr/brickr-client";
import { ProductBanner, ProductLogo } from "@/components/eureka/product-logo";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill, ThreadTag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { getMember } from "@/lib/auth/guards";
import { myWaitlist, qqLog, qqStages } from "@/lib/brickr/queries";
import { isProduct, PRODUCT_INFO } from "@/lib/eureka";
import { formatDate } from "@/lib/events/format";

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const { product } = await params;
  return { title: isProduct(product) ? `${PRODUCT_INFO[product].name} · Eureka` : "Eureka" };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ ref?: string; tab?: string }> }) {
  const [{ product }, { ref, tab }] = await Promise.all([params, searchParams]);
  if (!isProduct(product)) notFound();
  const info = PRODUCT_INFO[product];
  // The house look's "Waiting list" section shows only the waitlist card.
  const waitlistOnly = tab === "waitlist";
  const refCode = ref && /^[2-9A-Z]{8}$/.test(ref) ? ref : null;
  const member = await getMember();
  const [stages, log, mine] = await Promise.all([qqStages(product), qqLog(product), member ? myWaitlist(member.id, product) : null]);
  const nowIdx = stages.findIndex((s) => s.progress < 100);

  // The product's own accent (not Eureka's violet) for progress, choices and buttons.
  const vars = { "--pa": info.brand.accent, "--pt": info.brand.accentText } as React.CSSProperties;
  return (
    <div className="contents" style={vars}>
      <WeaveHero
        id={`${product}-weave`}
        above={<ThreadTag thread="QuidQuo" label={`Eureka · ${info.name} · building now`} />}
        title={info.name}
        description={info.description}
        actions={mine ? <StatusPill tone="ok">On the waitlist</StatusPill> : undefined}
      />
      <ProductBanner product={product} className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line px-5 py-5 shadow-depth desk:px-7">
        <div className="flex min-w-0 flex-col gap-2.5">
          <ProductLogo product={product} height={44} />
          <span className="text-[13.5px]" style={{ color: info.brand.muted }}>{info.tagline}</span>
        </div>
        {mine ? (
          <StatusPill tone="ok">On the waitlist</StatusPill>
        ) : (
          <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ backgroundColor: info.brand.accent, color: info.brand.accentText }}>In development</span>
        )}
      </ProductBanner>
      {waitlistOnly ? null : (
      <Card>
        <CardHeader title="Where we are" action={stages.length ? <span className="font-normal text-faint">Stage {Math.max(1, (nowIdx < 0 ? stages.length - 1 : nowIdx) + 1)} of {stages.length}</span> : null} />
        {stages.length ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            {stages.map((s, i) => (
              <div key={s.id} className={cn("flex flex-col gap-1.5 rounded-xl border p-3", i === nowIdx ? "border-[var(--pa)] bg-[color-mix(in_srgb,var(--pa)_12%,transparent)]" : "border-line")}>
                <div className="h-1.5 overflow-hidden rounded-full bg-hover"><span className="block h-full rounded-full" style={{ width: `${s.progress}%`, backgroundColor: info.brand.accent }} /></div>
                <span className={cn("text-[11px] font-extrabold tracking-[1.2px] uppercase", s.progress ? "text-fg" : "text-faint")}>
                  Stage {i + 1} · {s.progress >= 100 ? "Done" : i === nowIdx ? "Now" : "Next"}
                </span>
                <b className="text-[14px]">{s.name}</b>
                <span className="text-[13px] text-faint">{s.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-faint">Stages are on the way.</span>
        )}
      </Card>
      )}
      <div className={waitlistOnly ? "grid max-w-[560px] gap-4" : "grid gap-4 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-[18px]"}>
        {waitlistOnly ? null : (
        <Card>
          <CardHeader title="Build log" />
          {log.length ? (
            <ul className="flex flex-col">
              {log.map((l) => (
                <li key={l.id} className="flex items-start gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="w-[84px] shrink-0 text-[12.5px] font-bold text-faint">{formatDate(l.entry_date + "T12:00:00Z")}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold">{l.title}</div>
                    {l.body ? <span className="text-[13.5px] text-muted">{l.body}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>The first entries are coming soon.</EmptyState>
          )}
        </Card>
        )}
        <aside className="flex min-w-0 flex-col gap-4">
          {mine ? (
            <Card>
              <JoinedMark />
              <h2 className="text-[15px] font-extrabold">You&apos;re on the {info.name} list</h2>
              <span className="text-[13px] text-muted">Joined as {mine.role.toLowerCase()}{member?.email ? ` with ${member.email}` : ""}. We&apos;ll message you before each stage opens.</span>
              <CopyInviteButton product={product} code={mine.invite_code} />
              <details className="text-[13px]">
                <summary className="cursor-pointer font-bold text-link">Change my details</summary>
                <div className="mt-2">
                  <WaitlistForm product={product} signedIn refCode={null} current={mine} />
                </div>
              </details>
              <LeaveWaitlistButton product={product} />
            </Card>
          ) : (
            <Card>
              <h2 className="text-[15px] font-extrabold">Be first to try {info.name}</h2>
              {refCode ? <span className="text-[12.5px] text-faint">You were invited by a member.</span> : null}
              <WaitlistForm product={product} signedIn={!!member} refCode={refCode} current={null} />
            </Card>
          )}
          <Card className="border-[color-mix(in_srgb,var(--pa)_45%,transparent)]">
            <h2 className="text-[15px] font-extrabold">Shape what we build</h2>
            <span className="text-[13px]">Waitlist members join short feedback calls and try features first.</span>
          </Card>
        </aside>
      </div>
    </div>
  );
}
