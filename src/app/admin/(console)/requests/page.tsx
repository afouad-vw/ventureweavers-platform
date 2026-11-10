import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";
import { adminInbox } from "@/lib/brickr/queries";
import { createClient } from "@/lib/supabase/server";
import { RequestsInbox } from "./inbox";
import { SchedulingSettings } from "./scheduling-settings";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [items, base, { data: settings }] = await Promise.all([
    adminInbox(),
    currentAdminBase(),
    supabase.from("site_settings").select("key, value").in("key", ["calendly_url", "custom_program_email"]),
  ]);
  const setting = (k: string) => String(((settings ?? []) as { key: string; value: string }[]).find((x) => x.key === k)?.value ?? "");
  return (
    <>
      <PageHeader title="Requests" description="Every meeting request, private session and application in one place." />
      <RequestsInbox items={items} spaces={["BRICKR", "Outloud", "TVS"]} base={base} />
      <SchedulingSettings calendly={setting("calendly_url")} inbox={setting("custom_program_email")} keysSet={Boolean(process.env.CALENDLY_TOKEN && process.env.CALENDLY_SIGNING_KEY)} />
    </>
  );
}
