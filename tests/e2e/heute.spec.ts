import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Der Heute-Screen (H-01, Konzept §5).
 *
 * Geprüft wird, was die Seite ausmacht: **echte** Zahlen statt der Attrappe
 * aus F-07, der nächste Termin mit Countdown, und die zwei Wege heraus –
 * üben und Hausaufgabe fotografieren. Dazu die Trennlinie aus ADR 0012:
 * Ein Elternteil sieht den Termin, aber keinen Lernstand.
 *
 * Der Umweg über den Kind-Umschalter ist derselbe wie in `practice.spec.ts`:
 * Die E2E-Rolle ist standardmäßig das Elternteil (`TUTR_E2E_ACTOR=parent`),
 * und die Seed-Daten hängen an Mia, nicht an Ben (dem ersten Kind der Liste).
 * Für die Kind-Sicht kommt der Ansichts-Umschalter dazu; am Ende stellt der
 * Test ihn zurück, damit die Reihenfolge der Specs egal bleibt.
 *
 * Nur mit Datenbank (`RUN_DB_TESTS=1`); der angelegte Termin trägt ein
 * eigenes Titel-Präfix und wird über die Migrationsrolle wieder entfernt.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

const PREFIX = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const TITEL = `${PREFIX} Les verbes pronominaux`;

/** In drei Tagen – sicher innerhalb des „bald"-Fensters von `istBald()`. */
function inDreiTagen(): string {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.describe("Heute", () => {
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

  test("zeigt Fälliges, den nächsten Termin und die zwei Wege heraus", async ({ page }) => {
    if (!admin) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt – siehe test-db.ts.");

    // Termin direkt in die Datenbank: Der Weg über das Formular ist schon in
    // `pruefungen.spec.ts` geprüft, hier geht es um die Anzeige auf „Heute".
    await admin`
      insert into calendar_event (student_id, school_year_id, subject_id, type, title, date, status)
      select s.student_id, sy.id, s.id, 'klassenarbeit', ${TITEL}, ${inDreiTagen()}::date, 'geplant'
      from subject s
      join student st on st.id = s.student_id and st.first_name = 'Mia'
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      where s.name = 'Französisch'
      limit 1`;

    // --- Kind auswählen, dann in die Kind-Ansicht ------------------------
    await page.goto("/heute");
    const kindSelect = page.getByLabel("Kind");
    const miaId = await kindSelect.locator("option", { hasText: "Mia" }).getAttribute("value");
    await kindSelect.selectOption({ label: "Mia" });
    await expect(kindSelect).toHaveValue(miaId!);

    // --- Elternsicht: Termin ja, Lernstand nein (ADR 0012 D3) ------------
    const termin = page.getByRole("main").getByText(TITEL);
    await expect(termin).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("main")).toContainText("in 3 Tagen");
    await expect(page.getByRole("main").getByRole("link", { name: "Üben" })).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("link", { name: "Hausaufgabe fotografieren" }),
    ).toHaveCount(0);

    // --- Kind-Ansicht ----------------------------------------------------
    await page
      .getByRole("group", { name: "Ansicht wechseln" })
      .getByRole("button", {
        name: "Kind",
      })
      .click();

    // Echte Zahl aus den Seed-Daten: zwölf Vokabeln, nicht 24 Karten (V-06a).
    await expect(page.getByRole("main").getByText("12 fällig")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("main")).toContainText("Französisch");

    // Der Termin steht auch hier, mit demselben Countdown.
    await expect(page.getByRole("main").getByText(TITEL)).toBeVisible();
    await expect(page.getByRole("main")).toContainText("in 3 Tagen");

    // Die zwei Wege heraus führen dorthin, wo wirklich gearbeitet wird.
    await expect(page.getByRole("main").getByRole("link", { name: "Üben" })).toHaveAttribute(
      "href",
      "/ueben",
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: "Hausaufgabe fotografieren" }),
    ).toHaveAttribute("href", "/tutor?einstieg=hausaufgabe");

    // --- Der Kamera-Knopf landet auf „Hausaufgabe", nicht auf „Freie Frage"
    await page.getByRole("main").getByRole("link", { name: "Hausaufgabe fotografieren" }).click();
    await expect(page.getByRole("heading", { name: "Tutor", level: 1 })).toBeVisible();
    await expect(page.getByRole("radio", { name: "hausaufgabe" })).toBeChecked();

    // Ansicht zurückstellen – die anderen Specs erwarten die Elternrolle.
    await page.goto("/heute");
    await page
      .getByRole("group", { name: "Ansicht wechseln" })
      .getByRole("button", {
        name: "Eltern",
      })
      .click();
    await expect(page.getByLabel("Kind")).toBeVisible({ timeout: 10_000 });
  });
});
