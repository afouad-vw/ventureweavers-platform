import { headers } from "next/headers";
import { AdminShell } from "@/components/shell/shells";
import { adminBase, SURFACE_HEADER } from "@/lib/hosts";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const base = adminBase((await headers()).get(SURFACE_HEADER));
  return <AdminShell base={base}>{children}</AdminShell>;
}
