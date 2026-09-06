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

const dbSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const skip = process.env.SKIP_ENV_VALIDATION === "1";

// NEXT_PUBLIC_*-Werte werden von Next zur Buildzeit textuell ersetzt, daher
// einzeln referenzieren – `process.env` ist im Browser ein leeres Objekt.
const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

/**
 * Öffentliche Umgebungsvariablen (im Client-Bundle erlaubt).
 * Lazy, damit ein Import von env.ts (z. B. für dbEnv) nicht sofort
 * die Client-Variablen validiert.
 */
export function clientEnv() {
  return skip
    ? (rawClientEnv as unknown as z.infer<typeof clientSchema>)
    : clientSchema.parse(rawClientEnv);
}

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() darf nicht im Browser aufgerufen werden.");
  }
  return skip
    ? (process.env as unknown as z.infer<typeof serverSchema>)
    : serverSchema.parse(process.env);
}

/**
 * Nur die Datenbank-URL – für den Drizzle-Client und Migrationen.
 * Entkoppelt von den übrigen Server-Secrets, damit ein Verbindungstest
 * nicht an einem noch fehlenden ANTHROPIC_API_KEY o. Ä. scheitert.
 */
export function dbEnv() {
  if (typeof window !== "undefined") {
    throw new Error("dbEnv() darf nicht im Browser aufgerufen werden.");
  }
  return skip ? (process.env as unknown as z.infer<typeof dbSchema>) : dbSchema.parse(process.env);
}
