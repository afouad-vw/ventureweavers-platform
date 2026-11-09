/** Supabase settings come from environment variables only (Vercel → Settings → Environment Variables). */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once the Supabase project is connected. Until then sign-in shows a "not switched on yet" message. */
export const supabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);
