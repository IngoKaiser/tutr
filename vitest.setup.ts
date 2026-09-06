import "@testing-library/jest-dom/vitest";

// .env.local für Integrationstests laden (z. B. den DB-Verbindungstest).
// Fehlt die Datei (CI), skippen die betroffenen Tests sich selbst.
try {
  process.loadEnvFile(".env.local");
} catch {
  // kein .env.local vorhanden – ok
}
