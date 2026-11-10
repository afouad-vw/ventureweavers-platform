import { AdminShell } from "@/components/shell/shells";
import { currentAdminBase, requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell base={await currentAdminBase()} name={admin.displayName} access={{ isSuper: admin.isSuper, perms: admin.perms }}>
      {children}
    </AdminShell>
  );
}
