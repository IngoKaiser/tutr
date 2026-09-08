import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * Wiederherstellung nach Passkey-Verlust (F-06d, ADR 0006 D4).
 *
 * Zwei getrennte Sorgen, zwei getrennte Tests:
 *
 * 1. **Die Erzeugungs-Oberfläche** läuft über den Dev-Actor-Bypass gegen ein
 *    Seed-Kind – unvermeidlich, der Bypass verknüpft ein Elternteil nur mit
 *    den Seed-Kindern (`e2eLogin()`). Sie berührt aber nur zwei nullbare
 *    Spalten an `student` (der Token), die kein anderer Test prüft – sicher
 *    parallel zu allem anderen.
 * 2. **Die Einlöse-Zeremonie** legt einen echten Passkey und eine echte
 *    Session an – genau das, was `settings.spec.ts`s „noch nichts
 *    eingerichtet"-Tests auf dem Seed-Kind voraussetzen. Ein Wegwerf-Kind
 *    (wie in `passkey.spec.ts`) umgeht die Kollision vollständig, statt sie
 *    nur zu verkürzen: Der Token entsteht per Migrations-Rolle direkt in der
 *    Datenbank, ohne über die – an den Bypass gebundene – Oberfläche zu gehen.
 *
 * Beide: nur Chromium (virtuelle Authenticators nur über CDP), nur mit
 * Datenbank (`RUN_DB_TESTS=1`).
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

test.describe("Wiederherstellung: Link erzeugen", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  test("zeigt einen Link mit dem Hinweis auf Geltungsdauer und Reichweite", async ({ page }) => {
    await page.goto("/einstellungen");
    await page.getByRole("button", { name: "Wiederherstellungslink erzeugen" }).click();

    const linkText = page.getByTitle("Klicken zum Kopieren");
    await expect(linkText).toBeVisible({ timeout: 10_000 });
    const url = await linkText.textContent();
    expect(url).toMatch(/\/wiederherstellen\?token=/);

    await expect(page.getByText(/gilt zwei Stunden und funktioniert einmal/)).toBeVisible();
  });
});

test.describe("Wiederherstellung: Zeremonie", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;
  let studentId: string | undefined;

  test.beforeAll(() => {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // Kein .env.local – dann bleibt admin undefined, die Tests überspringen sich selbst.
    }
    if (process.env.MIGRATION_DATABASE_URL) {
      admin = postgres(process.env.MIGRATION_DATABASE_URL, { prepare: false, max: 1 });
    }
  });

  test.afterAll(async () => {
    if (admin && studentId) await admin`delete from student where id = ${studentId}`;
    await admin?.end();
  });

  /** Ein Token direkt in der Datenbank, ohne die an den Bypass gebundene Oberfläche. */
  async function issueTokenForFreshStudent(): Promise<string> {
    if (!admin) throw new Error("MIGRATION_DATABASE_URL fehlt – siehe beforeAll.");

    const token = "test-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const [row] = await admin<{ id: string }[]>`
      insert into student (first_name, grade_level, recovery_token_hash, recovery_expires_at)
      values (${`Wegwerf${Date.now().toString().slice(-6)}`}, 8, ${hashToken(token)}, now() + interval '2 hours')
      returning id`;
    studentId = row.id;
    return token;
  }

  test("anlegen und ein zweiter Versuch mit demselben Link scheitert", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Virtuelle Authenticators nur über CDP.");

    const token = await issueTokenForFreshStudent();

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

    // Ohne jede Anmeldung erreichbar – der Proxy-Matcher schließt diese Route aus.
    await page.goto(`/wiederherstellen?token=${token}`);
    await expect(page.getByRole("heading", { name: /^Hallo Wegwerf/ })).toBeVisible();

    await page.getByRole("button", { name: "Passkey einrichten" }).click();
    await expect(page).toHaveURL(/\/heute$/, { timeout: 20_000 });

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "tutr_student")?.value).toBeTruthy();

    // Derselbe Link ein zweites Mal: der Token ist verbraucht.
    await page.goto(`/wiederherstellen?token=${token}`);
    await expect(page.getByRole("heading", { name: "Dieser Link ist ungültig" })).toBeVisible();
  });
});
