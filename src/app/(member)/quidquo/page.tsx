import { redirect } from "next/navigation";

/** QuidQuo moved into Eureka; old links (and invite links) keep working. */
export default async function QuidQuoRedirect({ searchParams }: { searchParams: Promise<{ ref?: string; tab?: string }> }) {
  const { ref, tab } = await searchParams;
  const q = new URLSearchParams();
  if (ref && /^[2-9A-Z]{8}$/.test(ref)) q.set("ref", ref);
  if (tab === "waitlist") q.set("tab", "waitlist");
  const s = q.toString();
  redirect(`/eureka/quidquo${s ? `?${s}` : ""}`);
}
