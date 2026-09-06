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
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
