import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

/**
 * Die Verbindung wird beim ersten Zugriff aufgebaut, nicht beim Import.
 *
 * Sonst reicht ein `import` in einer Datei, die nur Typen oder Hilfsfunktionen
 * braucht, um ohne gesetzte DATABASE_URL zu scheitern – in CI, im Build und in
 * jedem Test, der die Datenbank gar nicht anfasst.
 *
 * `prepare: false` ist für den Supabase Transaction Pooler (PgBouncer, Port
 * 6543) zwingend – Prepared Statements werden dort nicht unterstützt. In der
 * Entwicklung über `globalThis` wiederverwendet, damit HMR nicht bei jedem
 * Reload neue Verbindungen öffnet.
 */
export function getSql(): ReturnType<typeof postgres> {
  if (!globalForDb.sql) {
    const { DATABASE_URL } = dbEnv();
    globalForDb.sql = postgres(DATABASE_URL, { prepare: false });
  }
  return globalForDb.sql;
}

let cachedDb: ReturnType<typeof drizzle> | undefined;

export function getDb(): ReturnType<typeof drizzle> {
  cachedDb ??= drizzle({ client: getSql() });
  return cachedDb;
}
