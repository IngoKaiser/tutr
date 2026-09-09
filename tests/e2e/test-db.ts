import postgres from "postgres";

/**
 * Die Datenbankverbindung der E2E-Tests (F-13).
 *
 * Eine Stelle, an der steht, mit welcher Datenbank die Tests reden – und die
 * Antwort ist: **immer mit der Test-Datenbank, nie mit der Produktiven.**
 *
 * Vorher lud jede Spec für sich `.env.local` und griff auf
 * `MIGRATION_DATABASE_URL` zu. Das war dieselbe Datenbank, die auch die App
 * benutzt: Jeder lokale Testlauf schrieb in die echten Daten. Aufgefallen
 * nach dem ersten Deploy, als zwölf Wegwerf-Kinder aus `passkey.spec.ts`
 * neben den echten Zeilen lagen.
 *
 * Die Verbindung läuft als Migrationsrolle und umgeht damit RLS – für
 * Aufräumarbeiten und zum Nachsehen ist das beabsichtigt, und gegen die
 * Test-Datenbank ist es gefahrlos.
 */

let geladen = false;

function ladeTestEnv(): void {
  if (geladen) return;
  geladen = true;
  try {
    process.loadEnvFile(".env.test.local");
  } catch {
    // In CI kommen die Werte aus Secrets statt aus einer Datei.
  }
}

/**
 * Verbindung zur Test-Datenbank, oder `undefined`, wenn keine konfiguriert
 * ist. Der Aufrufer überspringt sich dann selbst – **nie** ersatzweise auf
 * eine andere Datenbank ausweichen.
 */
export function adminClient(): postgres.Sql | undefined {
  ladeTestEnv();
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!url) return undefined;
  return postgres(url, { prepare: false, max: 1 });
}
