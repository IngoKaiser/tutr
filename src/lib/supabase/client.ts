import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/**
 * Supabase-Client für Client-Komponenten (Browser).
 * Nutzt den öffentlichen Publishable Key – RLS greift.
 */
export function createClient() {
  const env = clientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
