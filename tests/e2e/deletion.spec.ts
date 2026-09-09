import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Kontolöschung (F-06e, ADR 0006 D5/D6).
 *
 * Zwei getrennte Sorgen, mit unterschiedlicher Reichweite:
 *
 * 1. **Die Bestätigungsflächen** – „Kind entfernen" und „Elternkonto
 *    löschen" öffnen, den Vornamen falsch eintippen, prüfen, dass der
 *    Löschknopf gesperrt bleibt, dann abbrechen. Läuft über den
 *    Dev-Actor-Bypass wie `settings.spec.ts` – **ausdrücklich nie bis zum
 *    Löschen**: Der Bypass zeigt in jedem E2E-Lauf dasselbe Seed-Elternteil
 *    mit Mia und Ben (`TUTR_E2E_ACTOR=parent` in `playwright.config.ts`),
 *    und ein echter Klick auf „Ja, löschen" nähme jedem anderen Spec-File
 *    seine Grundlage weg. Braucht keine Datenbank – die Kindliste kommt aus
 *    `e2eLogin()`, einem Stub.
 *
 * 2. **Die Konsequenz eines gelöschten Kontos aus Sicht des Geräts, das
 *    nichts davon weiß.** Ein Wegwerf-Kind registriert sich echt und legt
 *    einen echten Passkey an (wie `passkey.spec.ts`), die Zeile wird direkt
 *    per Migrationsrolle gelöscht (Löschen selbst ist in `identity.test.ts`
 *    geprüft, nicht hier), und dasselbe Gerät versucht, sich mit demselben
 *    Passkey erneut anzumelden. Das ist der Fall aus dem Planungsgespräch:
 *    Der Server kennt das Konto nicht mehr, der virtuelle Authenticator
 *    bietet den Passkey trotzdem an. Nur Chromium (virtuelle Authenticators
 *    nur über CDP), nur mit Datenbank (`RUN_DB_TESTS=1`).
 *
 * Beide Elternteil-Wege der Löschung – „Kind entfernen" und „Elternkonto
 * löschen" – enden dagegen für einen echten Klick ohne einen echten
 * Eltern-Login (F-10), den es in Playwright noch nicht gibt. Deshalb bleibt
 * das Löschen selbst dort Sache der Policy-Tests.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

test.describe("Löschen: Bestätigungsflächen", () => {
  test("Kind entfernen bleibt gesperrt, bis der Vorname passt", async ({ page }) => {
    await page.goto("/einstellungen");
    await page.getByLabel("Kind").selectOption({ label: "Mia" });

    await page.getByRole("button", { name: "Kind entfernen" }).click();
    const confirm = page.getByRole("button", { name: "Kind entfernen" }).last();
    await expect(confirm).toBeDisabled();

    await page.getByLabel(/Zum Bestätigen/).fill("Ben");
    await expect(confirm).toBeDisabled();

    await page.getByLabel(/Zum Bestätigen/).fill("Mia");
    await expect(confirm).toBeEnabled();

    // Nie klicken – Mia ist die Seed-Grundlage für den ganzen E2E-Lauf.
    await page.getByRole("button", { name: "Abbrechen" }).click();
    await expect(page.getByLabel(/Zum Bestätigen/)).toHaveCount(0);
  });

  test("Elternkonto löschen fragt zweistufig nach, ohne Eintippen", async ({ page }) => {
    await page.goto("/einstellungen");

    await page.getByRole("button", { name: "Elternkonto löschen" }).click();
    await expect(page.getByText("Wirklich löschen?")).toBeVisible();

    const confirm = page.getByRole("button", { name: "Ja, löschen" });
    await expect(confirm).toBeEnabled();

    // Auch hier: nie klicken.
    await page.getByRole("button", { name: "Abbrechen" }).click();
    await expect(page.getByText("Wirklich löschen?")).toHaveCount(0);
  });
});

test.describe("Löschen: Konsequenz für ein Gerät, das nichts davon weiß", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;

  test.beforeAll(() => {
    // Immer die Test-Datenbank, nie die Produktive (F-13) – siehe test-db.ts.
    // `undefined`, wenn keine konfiguriert ist: Dann überspringt sich der
    // Test selbst, statt auf eine andere Datenbank auszuweichen.
    admin = adminClient();
  });

  test.afterAll(async () => {
    await admin?.end();
  });

  test("der Passkey bietet sich an, der Server kennt das Konto aber nicht mehr", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Virtuelle Authenticators nur über CDP.");
    if (!admin) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt – siehe test-db.ts.");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    const firstName = `Weg${Date.now().toString().slice(-6)}`;

    await page.goto("/registrieren");
    await page.getByLabel("Vorname").fill(firstName);
    await page.getByLabel("Jahrgang").selectOption("8");
    await page.getByLabel("E-Mail deiner Eltern").fill("eltern@example.org");
    await page.getByRole("button", { name: "Profil anlegen" }).click();
    await expect(page).toHaveURL(/\/heute$/, { timeout: 20_000 });

    // So verschwindet die Zeile bei „Elternteil löscht Kind" ebenfalls – über
    // die Kaskade, nicht über Anwendungscode. Direkt per Migrationsrolle statt
    // über die Oberfläche: Die zeigt unter dem Dev-Actor-Bypass ohnehin immer
    // das Seed-Elternteil, nie dieses Wegwerf-Kind (siehe Datei-Kommentar).
    await admin`delete from student where first_name = ${firstName}`;

    // Dasselbe Gerät, derselbe Passkey – aber ohne Session-Cookie, damit die
    // Zeremonie wirklich läuft statt nur die bestehende Sitzung zu nutzen.
    await page.context().clearCookies({ name: "tutr_student" });
    await page.goto("/anmelden");
    await page.getByRole("button", { name: /Face ID/i }).click();

    await expect(
      page.getByText("Dieser Passkey gehört zu keinem Profil. Leg dir eines an."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/anmelden$/);
  });
});
