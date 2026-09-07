/**
 * Bringt eine Datenbank auf den aktuellen Stand: erst die Drizzle-Migrationen,
 * dann die SQL-Dateien aus src/db/policies/ (Rollen-Setup und RLS-Policies).
 * Läuft als Migrations-Rolle (umgeht RLS), lexikalische Reihenfolge, idempotent.
 *
 *   node scripts/db-apply.mts          # .env.local      → MIGRATION_DATABASE_URL
 *   node scripts/db-apply.mts --test   # .env.test.local → TEST_MIGRATION_DATABASE_URL
 *
 * Beides gehört zusammen: eine Migration ohne die zugehörige Policy hinterlässt
 * eine Tabelle ohne RLS, und genau das lässt der Metatest in src/db/rls.test.ts
 * fehlschlagen.
 *
 * Node führt TypeScript direkt aus; keine zusätzliche Abhängigkeit nötig.
 */
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const useTest = process.argv.includes("--test");
// Setzt das Passwort der Rolle tutr_app neu. Nur bewusst verwenden – siehe
// die Begründung in src/db/policies/0000-setup.sql.
const rotatePassword = process.argv.includes("--rotate-password");
const envFile = useTest ? ".env.test.local" : ".env.local";
const urlVar = useTest ? "TEST_MIGRATION_DATABASE_URL" : "MIGRATION_DATABASE_URL";

try {
  process.loadEnvFile(envFile);
} catch {
  // In CI kommen die Werte aus Secrets statt aus einer Datei.
}

const url = process.env[urlVar];
const password = process.env.TUTR_APP_DB_PASSWORD;

if (!url) throw new Error(`${urlVar} fehlt in ${envFile}.`);
if (!password) throw new Error(`TUTR_APP_DB_PASSWORD fehlt in ${envFile}.`);
if (!url.includes("sslmode=require")) {
  throw new Error(`${urlVar} hat kein sslmode=require – die Verbindung liefe im Klartext.`);
}

// drizzle-kit liest ausschließlich DATABASE_URL. Für die Test-Datenbank wird
// sie deshalb nur für diesen Unterprozess gesetzt, nie im eigenen Prozess.
console.log(`→ Migrationen (${useTest ? "Test-DB" : "Produktiv-DB"})`);
execFileSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

console.log("\n→ Policies");
const dir = path.join(import.meta.dirname, "..", "src", "db", "policies");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) throw new Error(`Keine .sql-Dateien in ${dir}.`);

const sql = postgres(url, { prepare: false, max: 1 });

try {
  for (const file of files) {
    const statements = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      // Passwort als Session-Variable statt im SQL-Text – es landet so weder
      // in Logs noch in pg_stat_activity.query.
      // `drop policy if exists` meldet sonst für jede noch fehlende Policy eine NOTICE.
      await tx`set local client_min_messages = warning`;
      await tx`select set_config('tutr.bootstrap_password', ${password}, true)`;
      await tx`select set_config('tutr.rotate_password', ${rotatePassword ? "on" : "off"}, true)`;
      await tx.unsafe(statements);
    });
    console.log(`✓ ${file}`);
  }
  console.log(
    `\n${files.length} Policy-Datei(en) angewandt auf ${useTest ? "Test-DB" : "Produktiv-DB"}.`,
  );
} finally {
  await sql.end();
}
