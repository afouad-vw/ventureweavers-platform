import { redirect } from "next/navigation";
import { currentAdminBase } from "@/lib/auth/guards";
import { adminHref } from "@/lib/hosts";

/** 2-step verification was removed (Phase 10). Old links land in the console, which asks for sign-in if needed. */
export default async function VerifyPage() {
  redirect(adminHref("/admin", await currentAdminBase()));
}
