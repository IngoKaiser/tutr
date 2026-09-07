import { defineConfig } from "drizzle-kit";

// drizzle-kit lädt .env.local nicht von selbst.
try {
  process.loadEnvFile(".env.local");
} catch {
  // In CI o. Ä. nicht vorhanden – dann muss DATABASE_URL anders gesetzt sein.
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL fehlt. .env.local anlegen (siehe .env.example).");
}

export default defineConfig({
  // Extglob statt Verzeichnispfad: sonst versucht drizzle-kit auch *.test.ts
  // als Schema zu laden, sobald die erste Testdatei neben dem Schema liegt.
  // drizzle-kit unioniert die Treffer mehrerer Muster ohne Ausschluss-Semantik
  // (prepareFilenames in node_modules/drizzle-kit/bin.cjs) – ein "!"-Präfix im
  // Array wirkt dort NICHT als Negation, sondern muss als Extglob-Muster selbst
  // formuliert werden.
  schema: "./src/db/schema/!(*.test).ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
