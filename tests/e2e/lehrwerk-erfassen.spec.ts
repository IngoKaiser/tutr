import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Lehrwerk pro Fach erfassen (L-01, §7/§10) – der Weg **ohne** Modellaufruf
 * gegen die echte Datenbank: ein vorhandenes (kuratiertes) Lehrwerk zuordnen,
 * entfernen. Foto- und Websuche-Weg brauchen `ANTHROPIC_API_KEY` wie beim
 * Klausurplan-Bild-Import (K-03) und werden von Hand gegen die echte API
 * geprüft, nicht hier.
 *
 * Eigenes Testfach + eigenes kuratiertes Testbuch statt der bestehenden
 * Seed-Zuordnung Französisch↔Découvertes 4: `mobile` und `desktop` laufen
 * als **eigene Playwright-Projekte parallel** gegen dieselbe Test-DB, beide
 * als Mia (`TUTR_E2E_ACTOR`). Ein Test, der die geteilte Seed-Zuordnung
 * entfernt/setzt, träfe sich mit dem zweiten Projekt auf derselben Zeile –
 * genau das ist beim ersten Anlauf passiert (mobile schlug fehl, weil
 * desktop die Zuordnung parallel entfernte). Ein eindeutig benanntes,
 * per Lauf frisches Fach/Lehrwerk (wie `PREFIX` bei den anderen E2E-Importen)
 * macht die beiden Projekte voneinander unabhängig.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

const PREFIX = `e2elehrwerk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const FACH = `${PREFIX} Testfach`;
const BUCH = `${PREFIX} Testbuch`;

test.describe("Lehrwerk pro Fach erfassen", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;

  test.beforeAll(async () => {
    admin = adminClient();
    if (!admin) return;

    const [mia] = await admin<{ id: string }[]>`
      select id from student where first_name = 'Mia'`;
    const [schoolYear] = await admin<{ id: string }[]>`
      select id from school_year where student_id = ${mia!.id} and status = 'aktiv'`;

    const [subject] = await admin<{ id: string }[]>`
      insert into subject (student_id, name) values (${mia!.id}, ${FACH}) returning id`;
    await admin`
      insert into school_year_subject (student_id, school_year_id, subject_id)
      values (${mia!.id}, ${schoolYear!.id}, ${subject!.id})`;

    // Kuratiert (student_id null), wie das Seed-Lehrwerk „Découvertes 4" –
    // ohne KI zuordenbar, unabhängig vom eigenen Fach-Freitext des Kandidaten.
    const [textbook] = await admin<{ id: string }[]>`
      insert into textbook (student_id, title, subject, source)
      values (null, ${BUCH}, ${FACH}, 'manuell') returning id`;
    await admin`
      insert into chapter (student_id, textbook_id, title, sequence)
      values (null, ${textbook!.id}, 'Kapitel 1', 1)`;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin`delete from subject where name = ${FACH}`;
    await admin`delete from textbook where title = ${BUCH}`;
    await admin.end();
  });

  test("ein kuratiertes Lehrwerk zuordnen und die Zuordnung wieder entfernen", async ({ page }) => {
    if (!admin) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt – siehe test-db.ts.");

    await page.goto("/heute");
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    await page.getByRole("button", { name: "Kind" }).click();

    await page.goto("/faecher");
    await page
      .getByRole("listitem")
      .filter({ hasText: FACH })
      .getByRole("link", { name: "Lehrwerk" })
      .click();

    await expect(page.getByText("Kein Lehrwerk hinterlegt")).toBeVisible();

    await page.getByRole("button", { name: "Lehrwerk erfassen" }).click();
    const kandidat = page.getByRole("listitem").filter({ hasText: BUCH });
    await expect(kandidat).toBeVisible();
    await kandidat.getByRole("button", { name: "Zuordnen" }).click();

    await expect(page.getByRole("heading", { name: BUCH })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Kapitel 1")).toBeVisible();

    await page.getByRole("button", { name: "Zuordnung entfernen" }).click();
    await expect(page.getByText("Kein Lehrwerk hinterlegt")).toBeVisible({ timeout: 10_000 });
  });
});
