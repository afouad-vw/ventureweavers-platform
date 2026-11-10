import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";
import { TeamBoard, type TeamRow } from "./team-board";

export const metadata: Metadata = { title: "Team & access" };

export default async function TeamPage() {
  const me = await requireAdmin("super");
  const svc = createServiceClient();
  const { data } = await svc.from("admin_users").select("user_id, username, display_name, is_super, permissions, paused_at, created_at").order("is_super", { ascending: false }).order("created_at");
  const rows: TeamRow[] = await Promise.all(
    ((data ?? []) as { user_id: string; username: string; display_name: string; is_super: boolean; permissions: string[]; paused_at: string | null; created_at: string }[]).map(async (a) => {
      const { data: u } = await svc.auth.admin.getUserById(a.user_id);
      return {
        id: a.user_id,
        name: a.display_name,
        username: a.username,
        email: u?.user?.email ?? null,
        isSuper: a.is_super,
        perms: a.permissions ?? [],
        paused: Boolean(a.paused_at),
        pending: !u?.user?.last_sign_in_at,
        lastSignIn: u?.user?.last_sign_in_at ?? null,
        isMe: a.user_id === me.userId,
      };
    }),
  );
  return (
    <>
      <PageHeader title="Team & access" description="Who can open the admin console and what each person can do. Ahmed and Karim are super admins with full access." />
      <TeamBoard rows={rows} />
    </>
  );
}
