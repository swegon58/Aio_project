import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only client using the Supabase service role key — bypasses RLS.
// Use ONLY for trusted server-side operations (registry seed/lookup).
// Never expose this client or the service role key to the browser.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
