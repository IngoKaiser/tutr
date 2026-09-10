import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Prüfungskalender (K-01, Konzept §6 M7).
 *
 * Ein durchgehender Weg: Termin eintragen → in der Liste „Kommend" →
 * bearbeiten → absagen (rutscht in die Historie, wird nicht gelöscht) →
 * endgültig löschen. Genau so bedient man die Seite.
 *
 * Anders als bei Vokabeln schreibt hier **auch das Elternteil** (ADR 0004 D4),
 * also kein Rollenwechsel nötig – der Test läuft mit der Standard-E2E-Rolle
 * (`TUTR_E2E_ACTOR=parent`) auf beiden Projekten. Nur das Kind muss auf Mia
 * stehen: Der Seed legt die Fächer bei Mia an, nicht bei Ben (dem ersten
 * Kind in der Liste), sonst käme die Fach-Auswahl leer.
 *
 * Nur mit Datenbank (`RUN_DB_TESTS=1`); räumt am Ende unter einem eigenen
 * Titel-Präfix über die Migrationsrolle auf, damit Wiederholungen und die
 * Seed-Daten unberührt bleiben.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

const PREFIX = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const TITEL = `${PREFIX} Bruchrechnung`;
const TITEL_NEU = `${PREFIX} Bruchrechnung, Teil 2`;

/** In einer Woche – sicher im 4-Wochen-Fenster von „Kommend". */
function inEinerWoche(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.describe("Prüfungskalender", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;

  test.beforeAll(() => {
    admin = adminClient();
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin`delete from calendar_event where title like ${PREFIX + "%"}`;
    await admin.end();
  });

  test("eintragen, bearbeiten, absagen, löschen", async ({ page }) => {
    if (!admin) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt – siehe test-db.ts.");

    // --- Eintragen ------------------------------------------------------
    await page.goto("/pruefungen");
    // Seed-Fächer hängen an Mia; Ben (erstes Kind) hätte keine.
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    await page.getByRole("button", { name: "Termin eintragen" }).click();
    await page.getByLabel("Fach").selectOption({ label: "Französisch" });
    await page.getByLabel("Art").selectOption({ label: "Klassenarbeit" });
    await page.getByLabel("Titel").fill(TITEL);
    await page.getByLabel("Datum").fill(inEinerWoche());
    await page.getByRole("button", { name: "Eintragen" }).click();

    const kommend = page.getByRole("main").getByRole("listitem").filter({ hasText: TITEL });
    await expect(kommend).toBeVisible({ timeout: 10_000 });
    await expect(kommend).toContainText("Französisch · Klassenarbeit");

    const [{ count: nachAnlegen }] = await admin<{ count: string }[]>`
      select count(*)::text as count from calendar_event where title like ${PREFIX + "%"}`;
    expect(Number(nachAnlegen)).toBe(1);

    // --- Bearbeiten ---------------------------------------------------------
    await kommend.getByRole("button", { name: "Bearbeiten" }).click();
    await page.getByLabel("Titel").fill(TITEL_NEU);
    await page.getByRole("button", { name: "Speichern" }).click();

    const bearbeitet = page.getByRole("main").getByRole("listitem").filter({ hasText: TITEL_NEU });
    await expect(bearbeitet).toBeVisible({ timeout: 10_000 });

    // --- Absagen: bleibt bestehen, rutscht in die Historie ----------------
    await bearbeitet.getByRole("button", { name: "Absagen" }).click();
    await expect(bearbeitet).toContainText("abgesagt", { timeout: 10_000 });

    const historie = page.getByRole("main").getByRole("listitem").filter({ hasText: TITEL_NEU });
    await expect(historie.getByRole("button", { name: "Absagen" })).toHaveCount(0);
    await expect(historie.getByRole("button", { name: "Wieder planen" })).toBeVisible();

    // Die Zeile ist noch da – Absagen ist kein Löschen.
    const [{ count: nachAbsage }] = await admin<{ count: string }[]>`
      select count(*)::text as count from calendar_event where title like ${PREFIX + "%"}`;
    expect(Number(nachAbsage)).toBe(1);

    // --- Löschen: endgültig ----------------------------------------------
    await historie.getByRole("button", { name: "Löschen" }).click();
    await historie.getByRole("button", { name: "Ja, löschen" }).click();
    await expect(page.getByText(TITEL_NEU)).toHaveCount(0, { timeout: 10_000 });

    const db = admin;
    await expect
      .poll(
        async () =>
          Number(
            (
              await db<{ count: string }[]>`
                select count(*)::text as count from calendar_event where title like ${PREFIX + "%"}`
            )[0]!.count,
          ),
        { timeout: 10_000 },
      )
      .toBe(0);
  });
});
