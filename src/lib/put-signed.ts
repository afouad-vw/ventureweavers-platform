import { supabasePublicKey } from "@/lib/supabase/env";

/** Send a file to a one-time Supabase Storage upload link. */
export async function putSigned(url: string, contentType: string, file: File): Promise<boolean> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "content-type": contentType, "x-upsert": "false", "cache-control": "max-age=31536000", apikey: supabasePublicKey },
  }).catch(() => null);
  return Boolean(res?.ok);
}
