import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Supabase in the browser, signed in as the current person. Used only for Realtime (live mode). */
export function browserClient() {
  client ??= createBrowserClient(supabaseUrl, supabasePublicKey);
  return client;
}
