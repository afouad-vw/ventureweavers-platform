import "server-only";
import { alertPartners } from "@/lib/email/brickr";
import { esc } from "@/lib/email/send";
import { createServiceClient } from "@/lib/supabase/service";

type Kind = "community" | "discussion";
const TABLE: Record<Kind, string> = { community: "communities", discussion: "discussions" };

/** The current review state of a community or discussion, by id or slug. */
export async function reviewState(kind: Kind, by: { id?: string; slug?: string }): Promise<{ id: string; status: string; name: string } | null> {
  const svc = createServiceClient();
  const col = kind === "community" ? "id, status, name" : "id, status, name:title";
  const q = svc.from(TABLE[kind]).select(col);
  const { data } = await (by.id ? q.eq("id", by.id) : q.eq("slug", by.slug ?? "")).maybeSingle();
  return (data ?? null) as { id: string; status: string; name: string } | null;
}

/** Emails the partners when a community or discussion starts waiting for approval (new, or resubmitted). */
export async function alertIfPending(kind: Kind, by: { id?: string; slug?: string }, before: string | null = null): Promise<void> {
  try {
    const now = await reviewState(kind, by);
    if (!now || now.status !== "pending" || before === "pending") return;
    const again = before === "declined";
    await alertPartners(
      `${again ? "Resubmitted" : "New"} ${kind} waiting for approval: ${now.name}`,
      [`<b>${esc(now.name)}</b> ${again ? "was edited and sent back for review" : "was created"} in BLong and is waiting for approval.`, "Approve or decline it in Admin › Community › Approvals."],
      "/admin/community?view=approvals",
    );
  } catch {
    // An alert that fails never blocks the member.
  }
}
