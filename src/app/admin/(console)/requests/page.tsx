import type { Metadata } from "next";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { adminInbox } from "@/lib/brickr/queries";
import { adminNews } from "@/lib/news/queries";
import { createClient } from "@/lib/supabase/server";
import { RequestsInbox } from "./inbox";
import { NewsReview } from "./news-review";
import { SchedulingSettings } from "./scheduling-settings";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin(["requests.view", "content.view"]);
  const seeRequests = can(admin, "requests.view");
  const { tab: raw } = await searchParams;
  const tab = raw === "news" || !seeRequests ? "news" : "requests";
  const supabase = await createClient();
  const [items, news, base, { data: settings }] = await Promise.all([
    seeRequests && tab === "requests" ? adminInbox() : Promise.resolve([]),
    adminNews(),
    currentAdminBase(),
    supabase.from("site_settings").select("key, value").in("key", ["calendly_url", "custom_program_email"]),
  ]);
  const setting = (k: string) => String(((settings ?? []) as { key: string; value: string }[]).find((x) => x.key === k)?.value ?? "");
  const toReview = news.filter((n) => n.status === "submitted" || n.status === "in_review").length;
  return (
    <>
      <PageHeader title="Requests" description="Every meeting request, private session, application and member news submission in one place." />
      <LinkTabs
        label="Requests sections"
        value={tab}
        hrefFor={(v) => `${base}/requests${v === "news" ? "?tab=news" : ""}`}
        items={[...(seeRequests ? [{ value: "requests", label: "Meetings & applications" }] : []), { value: "news", label: "Business news", count: toReview || null }]}
      />
      {tab === "requests" ? <RequestsInbox items={items} spaces={["BRICKR", "Outloud", "TVS"]} base={base} /> : null}
      {tab === "news" ? <NewsReview items={news} base={base} canEdit={can(admin, "content.manage")} appUrl={`https://${process.env.APP_HOST ?? "app.ventureweavers.com"}`} /> : null}
      {admin.isSuper && tab === "requests" ? <SchedulingSettings calendly={setting("calendly_url")} inbox={setting("custom_program_email")} keysSet={Boolean(process.env.CALENDLY_TOKEN && process.env.CALENDLY_SIGNING_KEY)} /> : null}
    </>
  );
}
