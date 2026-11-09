import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabasePublicKey, supabaseUrl } from "./env";

/**
 * Refresh the sign-in session on every request. `build` creates the response (next or rewrite)
 * from the current request headers; it is called again if cookies change so the refreshed
 * cookies reach both the page and the browser.
 */
export async function refreshSession(req: NextRequest, build: () => NextResponse): Promise<NextResponse> {
  let res = build();
  if (!supabaseConfigured) return res;
  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = build();
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return res;
}
