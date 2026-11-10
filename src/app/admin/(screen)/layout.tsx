import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/** Full-screen admin pages (the venue projector): no sidebar or top bar. */
export default async function ScreenLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="min-h-dvh bg-ink text-ink-fg">{children}</div>;
}
