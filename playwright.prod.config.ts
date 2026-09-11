import { defineConfig, devices } from "@playwright/test";

/**
 * E2E gegen den **Produktions-Bau**, mit echter Anmeldung (F-10a).
 *
 * Die reguläre Suite (`playwright.config.ts`) läuft gegen `next dev` und
 * umgeht die Anmeldung über `TUTR_E2E_ACTOR`. Das war von Anfang an ein
 * Kompromiss, und er hat eine Lücke offen gelassen, die genau zweimal
 * zugeschlagen hat:
 *
 * - **Was nur in Produktion anders ist, wurde nie geprüft.** Bei S-03a fiel
 *   auf, dass `/anmelden` und `/registrieren` statisch vorgerendert wurden –
 *   und eine vorgerenderte Seite bekommt kein CSP-`nonce`, ihre Skripte
 *   liefen unter der neuen Kopfzeile gar nicht mehr. Im Entwicklungsserver
 *   war davon nichts zu sehen. Gefunden wurde es von Hand.
 * - **Die Tür selbst wurde nie geprüft.** Dass ein Fremder ohne Sitzung auf
 *   `/anmelden` landet, ist die wichtigste Zusage der App – und mit dem
 *   Actor-Bypass ist sie in jedem Testlauf ausgeschaltet.
 *
 * Diese Suite schließt beides. Sie ist bewusst **klein**: Sie prüft, was
 * sich zwischen Entwicklung und Produktion unterscheidet, nicht noch einmal
 * alle Funktionen – die stehen in der regulären Suite.
 *
 * **Nur Chromium.** Angemeldet wird per Passkey über einen virtuellen
 * Authenticator, und den gibt es nur über das DevTools-Protokoll (dieselbe
 * Einschränkung wie in `passkey.spec.ts`). WebKit kennt nichts
 * Vergleichbares – und der Ansichts-Umschalter, über den die reguläre Suite
 * in die Kind-Sicht kommt, existiert in Produktion nicht.
 *
 * **Der Elternweg fehlt noch** (F-10b): Eine echte Anmeldung per Magic Link
 * bräuchte Supabase-Zugangsdaten für das *Test*-Projekt. In
 * `.env.test.local` stehen bis jetzt nur die beiden Datenbank-URLs; die
 * Schlüssel in `.env.local` gehören dem Produktivprojekt und dürfen hier
 * nicht hin (F-13).
 */
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // In CI kämen die Werte aus Secrets – siehe F-10b.
}

/**
 * Ohne diese Adresse liefe der Produktionsserver gegen `.env.local` – also
 * gegen die **Produktivdatenbank**. Genau das ist nach dem ersten Deploy
 * einmal passiert (F-13, zwölf Testkinder neben echten Daten), und ein
 * Produktionsbau macht es wahrscheinlicher, nicht unwahrscheinlicher: Er
 * sieht der echten App zum Verwechseln ähnlich.
 *
 * Der leere String ist kein Versehen: Next überschreibt eine gesetzte
 * Variable nicht mit dem Wert aus `.env.local`, und leer heißt
 * `databaseConfigured() === false`. Die Tests überspringen sich dann selbst,
 * statt still auf die echte Datenbank auszuweichen.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";

/** Nicht 3000: Ein laufender Entwicklungsserver soll nebenher weiterlaufen dürfen. */
const PORT = 3101;

export default defineConfig({
  testDir: "./tests/prod",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "produktion", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Nie einen laufenden Server wiederverwenden: Hier soll ein frischer
    // Bau geprüft werden, nicht irgendein Server, der zufällig antwortet.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      SKIP_ENV_VALIDATION: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      // **Kein `TUTR_E2E_ACTOR`** – das ist der Punkt dieser Suite. Er wäre
      // hier ohnehin wirkungslos: `e2eActor()` ist in Produktion hart aus.
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
