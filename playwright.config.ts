import { defineConfig, devices } from "@playwright/test";

/**
 * E2E läuft gegen die **Test-Datenbank**, nie gegen die Produktivdatenbank
 * (F-13).
 *
 * Vorher stand hier kein `DATABASE_URL`, also lud `next dev` die `.env.local`
 * und redete mit der echten Datenbank. Aufgefallen ist das nach dem ersten
 * Deploy: Zwölf „Testkind…"-Zeilen aus `passkey.spec.ts` lagen samt Passkeys
 * neben den echten Daten. Die Tests waren nie falsch – sie zeigten nur auf
 * die falsche Datenbank.
 *
 * Next.js überschreibt bereits gesetzte Umgebungsvariablen nicht mit Werten
 * aus `.env`-Dateien. Was hier durchgereicht wird, gewinnt also gegen
 * `.env.local`.
 */
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // In CI kommen die Werte aus Secrets statt aus einer Datei.
}

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 14"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Entwicklungsserver, nicht Produktions-Build. Grund: Ab F-05 verlangt der
    // Proxy eine Anmeldung, und in Produktion ist der Dev-Actor hart aus – ein
    // produktiver Server würde jeden Test auf /anmelden umleiten. Eine echte
    // Anmeldung im Test bräuchte serverseitig erzeugte Magic Links und
    // zusätzliche CI-Secrets; das ist als eigenes Ticket vermerkt (F-10).
    // Build-Fehler fängt weiterhin der eigene `npm run build`-Schritt in CI.
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      SKIP_ENV_VALIDATION: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      // Tests melden sich noch nicht echt an – siehe F-10.
      TUTR_E2E_ACTOR: "parent",
      // Der Kern von F-13: Ohne diese Zeile läuft der Testserver gegen die
      // Produktivdatenbank. Leer, wenn keine Test-DB konfiguriert ist – dann
      // liefert `databaseConfigured()` false und die DB-Specs überspringen
      // sich selbst, statt still auf die echte Datenbank auszuweichen.
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
