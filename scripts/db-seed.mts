/**
 * Spielt die Beispieldaten aus src/db/seed.ts ein.
 *
 *   npm run db:seed          # .env.local      → MIGRATION_DATABASE_URL
 *   npm run db:seed -- --test # .env.test.local → TEST_MIGRATION_DATABASE_URL
 *
 * Läuft als Migrations-Rolle und umgeht RLS – bei einem Seed beabsichtigt.
 * Idempotent: löscht nur die eigenen festen IDs und legt sie neu an.
 */
import postgres from "postgres";

import { seed } from "../src/db/seed.ts";

const useTest = process.argv.includes("--test");
const envFile = useTest ? ".env.test.local" : ".env.local";
const urlVar = useTest ? "TEST_MIGRATION_DATABASE_URL" : "MIGRATION_DATABASE_URL";

try {
  process.loadEnvFile(envFile);
} catch {
  // In CI kommen die Werte aus Secrets statt aus einer Datei.
}

const url = process.env[urlVar];
if (!url) throw new Error(`${urlVar} fehlt in ${envFile}.`);
if (!url.includes("sslmode=require")) {
  throw new Error(`${urlVar} hat kein sslmode=require – die Verbindung liefe im Klartext.`);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  await seed(sql);
  console.log(`Beispieldaten eingespielt (${useTest ? "Test-DB" : "Produktiv-DB"}).`);
  console.log("Familie A: Mia (Jg. 8) und Ben (Jg. 5) · Familie B: Lea (Jg. 8)");
} finally {
  await sql.end();
}
