import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** A suspended member lands here from the member app: sign them out on this device and show why. */
export async function GET(req: NextRequest) {
  if (supabaseConfigured) await (await createClient()).auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/sign-in?error=suspended", req.nextUrl.origin));
}
