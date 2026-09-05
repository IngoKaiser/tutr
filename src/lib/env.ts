import { z } from "zod";

/**
 * Zentrale, validierte Umgebungsvariablen.
 * Server-Variablen nie in Client-Komponenten importieren.
 * Mit SKIP_ENV_VALIDATION=1 (CI-Build ohne Secrets) werden nur Typen geprüft.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  INVITE_TOKEN_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const skip = process.env.SKIP_ENV_VALIDATION === "1";

export const clientEnv = skip
  ? (process.env as unknown as z.infer<typeof clientSchema>)
  : clientSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() darf nicht im Browser aufgerufen werden.");
  }
  return skip
    ? (process.env as unknown as z.infer<typeof serverSchema>)
    : serverSchema.parse(process.env);
}
