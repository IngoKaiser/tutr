import { defineConfig, devices } from "@playwright/test";

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
    env: { SKIP_ENV_VALIDATION: "1", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
