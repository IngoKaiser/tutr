import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";

/**
 * Supabase-Client für Server-Komponenten, Server Actions und Route Handler.
 * Liest/schreibt die Session über die Request-Cookies (async in Next 16).
 *
 * Auth-Middleware zum Erneuern abgelaufener Sessions kommt mit Ticket F-05.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = clientEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Aufruf aus einer Server-Komponente: Cookies sind hier read-only.
            // Unkritisch, solange die Middleware (F-05) die Session auffrischt.
          }
        },
      },
    },
  );
}
