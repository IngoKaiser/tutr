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
  // Signiert kurzlebige Auth-Cookies (die WebAuthn-Challenge, F-06). Hieß bis
  // ADR 0005 INVITE_TOKEN_SECRET – Einladungslinks gibt es nicht mehr.
  AUTH_COOKIE_SECRET: z.string().min(32),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Supabase "Publishable key" (neues API-Key-System, Präfix sb_publishable_) – öffentlich, RLS greift.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const dbSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const authSchema = z.object({
  AUTH_COOKIE_SECRET: z.string().min(32),
});

const mailSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  // Ohne verifizierte Domain akzeptiert Resend nur onboarding@resend.dev.
  RESEND_FROM: z.string().optional(),
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
 * Ist überhaupt eine Datenbank konfiguriert? Für Aufrufer, die ohne DB
 * einen leeren statt gar keinen Zustand zeigen können sollen – analog zu
 * `supabaseConfig()`.
 *
 * Der Anlass war ein CI-Fehlschlag: Die E2E-Umgebung setzt `SKIP_ENV_
 * VALIDATION=1` **ohne** `DATABASE_URL`, weil bis F-06b keine Seite unter
 * dem Dev-Actor-Bypass eine echte Verbindung brauchte. Ein ungeprüfter
 * `postgres(undefined, …)`-Aufruf hängt dort nicht mit einem Fehler, sondern
 * mit einem TCP-Verbindungsversuch ins Leere – sichtbar erst als 30-
 * Sekunden-Timeout beim Seitenaufruf, nicht als klarer Fehler.
 */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
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

/**
 * Schmale Ausschnitte, aus demselben Grund wie `dbEnv()` abgetrennt: Weder
 * die Anmeldung noch der Mailversand sollen daran scheitern, dass ein
 * ANTHROPIC_API_KEY fehlt. `serverEnv()` prüft alles auf einmal und ist
 * deshalb nur dort richtig, wo wirklich alles gebraucht wird.
 */
export function authEnv() {
  if (typeof window !== "undefined") {
    throw new Error("authEnv() darf nicht im Browser aufgerufen werden.");
  }
  return skip
    ? (process.env as unknown as z.infer<typeof authSchema>)
    : authSchema.parse(process.env);
}

export function mailEnv() {
  if (typeof window !== "undefined") {
    throw new Error("mailEnv() darf nicht im Browser aufgerufen werden.");
  }
  return skip
    ? (process.env as unknown as z.infer<typeof mailSchema>)
    : mailSchema.parse(process.env);
}
