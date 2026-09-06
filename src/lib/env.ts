import { z } from "zod";

/**
 * Zentrale, validierte Umgebungsvariablen.
 * Server-Variablen nie in Client-Komponenten importieren.
 * Mit SKIP_ENV_VALIDATION=1 (CI-Build ohne Secrets) werden nur Typen geprüft.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  // Supabase "Secret key" (neues API-Key-System, Präfix sb_secret_) – umgeht RLS, nur serverseitig.
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  INVITE_TOKEN_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Supabase "Publishable key" (neues API-Key-System, Präfix sb_publishable_) – öffentlich, RLS greift.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const skip = process.env.SKIP_ENV_VALIDATION === "1";

export const clientEnv = skip
  ? (process.env as unknown as z.infer<typeof clientSchema>)
  : clientSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() darf nicht im Browser aufgerufen werden.");
  }
  return skip
    ? (process.env as unknown as z.infer<typeof serverSchema>)
    : serverSchema.parse(process.env);
}
