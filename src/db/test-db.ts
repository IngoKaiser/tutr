import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Verbindungen zur Test-Datenbank. Nur für Tests – Policy-Tests sind destruktiv.
 *
 * Der Wächter unten ist der Grund, warum diese Datei existiert: ein Testlauf
 * gegen das Produktivprojekt wäre nicht zu reparieren.
 */
function projectRef(url: string): string | null {
  const match = /:\/\/[^:@/]*?\.?([a-z0-9]{20})[:@.]/.exec(url);
  return match ? match[1] : null;
}

export function testDbAvailable(): boolean {
  return process.env.RUN_DB_TESTS === "1" && Boolean(process.env.TEST_DATABASE_URL);
}

export function loadTestEnv(): void {
  try {
    process.loadEnvFile(".env.test.local");
  } catch {
    // In CI kommen die Werte aus GitHub-Secrets statt aus einer Datei.
  }
}

/**
 * Baut die Verbindung als Laufzeit-Rolle `tutr_app` – nur so greift RLS.
 * Bricht ab, wenn Test- und Produktivprojekt dieselbe Ref haben.
 */
export function connectAsAppRole() {
  const base = process.env.TEST_DATABASE_URL;
  const password = process.env.TUTR_APP_DB_PASSWORD;
  if (!base) throw new Error("TEST_DATABASE_URL fehlt.");
  if (!password) throw new Error("TUTR_APP_DB_PASSWORD fehlt.");

  const testRef = projectRef(base);
  const liveRef = process.env.DATABASE_URL ? projectRef(process.env.DATABASE_URL) : null;
  if (testRef && liveRef && testRef === liveRef) {
    throw new Error(
      `TEST_DATABASE_URL und DATABASE_URL zeigen auf dasselbe Supabase-Projekt (${testRef}). ` +
        "Policy-Tests sind destruktiv und werden nicht gegen die Produktivdatenbank ausgeführt.",
    );
  }

  const url = new URL(base);
  url.username = `tutr_app.${testRef}`;
  url.password = password;
  url.searchParams.set("sslmode", "require");

  const client = postgres(url.toString(), { prepare: false, max: 1 });
  return { db: drizzle({ client }), close: () => client.end() };
}

/** Migrations-Verbindung (Rolle `postgres`) für Auf- und Abbau der Fixtures. */
export function connectAsMigrationRole(): { client: postgres.Sql; close: () => Promise<void> } {
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!url) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt.");
  const client = postgres(url, { prepare: false, max: 1 });
  return { client, close: () => client.end() };
}
