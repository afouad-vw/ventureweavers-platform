import type { Metadata } from "next";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag } from "@/components/ui/tag";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminWaitlist, qqLog, qqStages } from "@/lib/brickr/queries";
import { isProduct, PRODUCT_INFO, PRODUCTS } from "@/lib/eureka";
import { LogManager, StagesManager, WaitlistTable } from "./eureka-admin";

export const metadata: Metadata = { title: "Eureka admin" };

export default async function AdminEurekaPage({ searchParams }: { searchParams: Promise<{ product?: string; tab?: string }> }) {
  await requireAdmin("quidquo.view");
  const base = await currentAdminBase();
  const { product: rawProduct, tab: raw } = await searchParams;
  const product = isProduct(rawProduct) ? rawProduct : "quidquo";
  const tab = raw === "log" || raw === "waitlist" ? raw : "stages";
  const [stages, log, waitlist] = await Promise.all([qqStages(product), qqLog(product, true), adminWaitlist(product)]);
  const name = PRODUCT_INFO[product].name;
  const href = (p: string, t: string) => {
    const q = new URLSearchParams();
    if (p !== "quidquo") q.set("product", p);
    if (t !== "stages") q.set("tab", t);
    const s = q.toString();
    return `${base}/eureka${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHeader above={<ThreadTag thread="QuidQuo" />} title="Eureka" description="Our products lab. Each product has its own stages, build log and waiting list." />
      <LinkTabs
        label="Products"
        value={product}
        hrefFor={(v) => href(v, "stages")}
        items={PRODUCTS.map((p) => ({ value: p, label: PRODUCT_INFO[p].name }))}
      />
      <LinkTabs
        label={`${name} sections`}
        value={tab}
        hrefFor={(v) => href(product, v)}
        items={[
          { value: "stages", label: "Stages", count: stages.length },
          { value: "log", label: "Build log", count: log.length },
          { value: "waitlist", label: "Waitlist", count: waitlist.length },
        ]}
      />
      {tab === "stages" ? <StagesManager key={`s-${product}`} product={product} stages={stages} /> : null}
      {tab === "log" ? <LogManager key={`l-${product}`} product={product} entries={log} /> : null}
      {tab === "waitlist" ? <WaitlistTable key={`w-${product}`} product={product} rows={waitlist} /> : null}
    </>
  );
}
