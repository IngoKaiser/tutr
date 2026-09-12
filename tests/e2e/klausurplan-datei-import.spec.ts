import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Datei-Import Klausurplan (K-04, §6 M7, ADR 0016) – kompletter Weg gegen
 * die echte Datenbank: Datei wählen → Übersicht → Übernehmen → Zeile mit
 * `source = 'datei'` steht im Kalender.
 *
 * **Anders als der Bild-Import (K-03) braucht dieser Weg keinen
 * `ANTHROPIC_API_KEY`** (ADR 0016 D4, kein Modellaufruf) – deshalb läuft er
 * in CI vollständig durch, nur DB-gated wie `pruefungen.spec.ts`.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

const PREFIX = `e2edatei${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const TITEL = `${PREFIX} Frz. Testarbeit`;

/** In einer Woche, deutsches Format – wie es ein CSV-Export typischerweise liefert. */
function inEinerWocheDe(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tag = String(d.getDate()).padStart(2, "0");
  const monat = String(d.getMonth() + 1).padStart(2, "0");
  return `${tag}.${monat}.${d.getFullYear()}`;
}

test.describe("Klausurplan-Import: Datei", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;

  test.beforeAll(() => {
    admin = adminClient();
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin`delete from calendar_event where title like ${PREFIX + "%"}`;
    // Die Gruppen-Einrichtung (siehe unten) setzt `own_groups` bei Mia als
    // Nebeneffekt – zurück auf den Seed-Zustand, damit Wiederholungen und
    // andere Specs (klausurplan-import.spec.ts) nicht davon abhängen.
    await admin`
      update school_year set own_groups = null
      where student_id in (select id from student where first_name = 'Mia')`;
    await admin.end();
  });

  test("CSV wählen, Übersicht, Übernehmen – ohne Modellaufruf", async ({ page }) => {
    if (!admin) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt – siehe test-db.ts.");

    await page.goto("/heute");
    // Seed-Fächer hängen an Mia, wie in pruefungen.spec.ts.
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    await page.getByRole("button", { name: "Kind" }).click();

    await page.goto("/pruefungen");
    await page.getByRole("link", { name: "Klausurplan einlesen" }).click();
    await page.getByRole("button", { name: "Datei" }).click();

    // Gruppe mit mehreren, leerzeichenhaltigen Tokens – deckt denselben Weg
    // ab, an dem `uebernehmen()` vor dem Fund vom 12.9.2026 an einem
    // „malformed array literal" gescheitert wäre (`calendar_event.groups`,
    // siehe `sql-array.ts`).
    const csv = `Datum;Fach;Art;Titel;Gruppe\n${inEinerWocheDe()};Französisch;Klassenarbeit;${TITEL};8.1, 8.2, 8.5\n`;
    await page.locator('input[type="file"]').setInputFiles({
      name: "klausurplan.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await expect(page.getByText("1 Zeile erkannt")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Zur Übersicht" }).click();

    // Gruppen-Einrichtung beim ersten Mal (ADR 0016 D3) – deckt zugleich den
    // Fund vom 12.9.2026 ab: „Weiter" schrieb `own_groups` über genau den
    // Weg, der am „malformed array literal" scheiterte (`sql-array.ts`).
    // `waitFor()`, nicht `isVisible()` allein – der Review-Kontext lädt
    // asynchron, eine sofortige Prüfung sieht die Einrichtung sonst nie.
    const beiEinrichtung = await page
      .getByRole("heading", { name: "Welche Zeilen betreffen dich?" })
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (beiEinrichtung) {
      // Mias Seed-Klasse ("8c") matcht keinen der Fixture-Tokens – ohne
      // eigenes Häkchen bliebe die Zeile „vermutlich nicht relevant" und
      // eingeklappt. "8.1" anhaken macht sie prominent.
      await page.getByRole("checkbox", { name: "8.1" }).check();
      await page.getByRole("button", { name: "Weiter" }).click();
    }

    const zeile = page.getByRole("listitem").filter({ hasText: TITEL });
    await expect(zeile).toBeVisible({ timeout: 10_000 });
    // Fach exakt "Französisch" erkannt (kein Präfix nötig) – Dropdown ist vorbelegt.
    await expect(zeile.getByRole("combobox")).not.toHaveValue("");

    await page.getByRole("button", { name: "Übernehmen" }).click();
    await expect(page.getByText(/1 Termin angelegt/)).toBeVisible({ timeout: 10_000 });

    const rows = await admin<{ source: string; groups: string[] }[]>`
      select source, groups from calendar_event where title = ${TITEL}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("datei");
    expect(rows[0]?.groups).toEqual(["8.1", "8.2", "8.5"]);
  });
});
