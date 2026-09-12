import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// .env.local für Integrationstests laden (z. B. den DB-Verbindungstest).
// Fehlt die Datei (CI), skippen die betroffenen Tests sich selbst.
try {
  process.loadEnvFile(".env.local");
} catch {
  // kein .env.local vorhanden – ok
}

/**
 * `@testing-library/react` registriert `afterEach(cleanup)` nur automatisch,
 * wenn `afterEach` global verfügbar ist – hier nicht, `vitest.config.mts`
 * setzt `globals: false`. Ohne diese Zeile bleibt jeder `render()` im DOM
 * stehen: Ein zweiter Test im selben Testfile sieht dann die Elemente aller
 * vorherigen Renders und `getByRole()` findet „mehrere Treffer", sobald zwei
 * Tests denselben Button-Text zeigen (Fund L-01, `lehrwerk-verwalten.test.tsx`
 * – bis dahin unbemerkt, weil bestehende Testdateien zufällig pro Testfall
 * unterschiedlichen Text verwendeten).
 */
afterEach(cleanup);
