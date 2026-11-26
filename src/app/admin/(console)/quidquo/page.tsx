import { redirect } from "next/navigation";
import { currentAdminBase } from "@/lib/auth/guards";

/** QuidQuo moved into Eureka. */
export default async function AdminQuidQuoRedirect({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, base] = await Promise.all([searchParams, currentAdminBase()]);
  redirect(`${base}/eureka${tab === "log" || tab === "waitlist" ? `?tab=${tab}` : ""}`);
}
