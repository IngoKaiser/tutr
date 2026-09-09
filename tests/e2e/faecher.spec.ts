import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Fächerverwaltung (F-16a, ADR 0009 D1/D2).
 *
 * Ein einziger durchgehender Weg statt vieler kleiner Tests – wie in
 * `vokabelverwaltung.spec.ts`: anlegen → umbenennen → Löschen scheitert an
 * einem Vokabelset → das Set weg → Löschen geht. Genau der Riegel, der ein
 * gelöschtes Fach daran hindert, Themen oder Sets stillschweigend
 * mitzureißen (`deleteSubject()`).
 *
 * Der eigentliche Punkt dieser Datei: Vorher konnte nur ein Elternteil ein
 * Fach anlegen – dieser Test läuft als **Kind**, ohne Umweg über die
 * Eltern-Rolle, genau die Lücke, die ADR 0009 D1 schließt.
 *
 * Nur Chromium (der Rollenwechsel bricht unter WebKit den Dev-Server ab,
 * siehe `practice.spec.ts`), nur mit Datenbank (`RUN_DB_TESTS=1`).
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";
const PREFIX = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const SUBJECT_NAME = `${PREFIX} Erdkunde`;
const SUBJECT_RENAMED = `${PREFIX} Geografie`;
const SET_TITLE = `${PREFIX} Hauptstädte`;

test.describe("Fächerverwaltung", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;

  test.afterAll(async () => {
    if (admin) {
      // `subject` kaskadiert auf `school_year_subject`; ein übrig gebliebenes
      // Set (falls der Test vorher abbricht) hängt per `restrict` noch dran
      // und muss zuerst weg.
      await admin`delete from vocab_set where title = ${SET_TITLE}`;
      await admin`delete from subject where name like ${PREFIX + "%"}`;
      await admin.end();
    }
  });

  test("Kind legt ein Fach an, benennt es um, und Löschen scheitert erst an einem Set", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebKit: Next-Dev-Server bricht nach dem Rollenwechsel ab.",
    );

    admin = adminClient();

    await page.goto("/heute");
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/faecher");

    // --- Anlegen: als Kind, ohne Elternteil (ADR 0009 D1) ---
    await page.getByRole("button", { name: "Neues Fach anlegen" }).click();
    await page.getByLabel("Name").fill(SUBJECT_NAME);
    await page.getByLabel("Sprache").selectOption("es");
    await page.getByRole("button", { name: "Anlegen" }).click();

    await expect(page.getByText(SUBJECT_NAME)).toBeVisible();
    await expect(page.getByText("Spanisch", { exact: true })).toBeVisible();

    // --- Umbenennen ---
    await page.getByText(SUBJECT_NAME).click();
    const nameField = page.getByLabel("Name");
    await nameField.fill(SUBJECT_RENAMED);
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByText(SUBJECT_RENAMED)).toBeVisible();
    await expect(page.getByText(SUBJECT_NAME)).toHaveCount(0);

    // --- Ein Set anlegen, das am neuen Fach hängt ---
    await page.goto("/faecher/vokabeln");
    await page.getByRole("button", { name: "Neues Set anlegen" }).click();
    await page.getByLabel("Fach").selectOption({ label: SUBJECT_RENAMED });
    await page.getByLabel("Name").fill(SET_TITLE);
    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByText(SET_TITLE)).toBeVisible();

    // --- Löschen scheitert, solange das Set existiert ---
    await page.goto("/faecher");
    await page.getByText(SUBJECT_RENAMED).click();
    await page.getByRole("button", { name: "Fach löschen" }).click();
    await expect(page.getByText(/Vokabelset.*entfernen/)).toBeVisible();
    // Der Riegel lässt die Zeile offen statt sie zu entfernen – „Speichern"
    // steht noch da, das Fach ist nicht weg.
    await expect(page.getByRole("button", { name: "Speichern" })).toBeVisible();

    // --- Set weg, dann geht das Löschen ---
    await page.goto("/faecher/vokabeln");
    // Zweistufiges Löschen wie in `set-list.tsx`.
    const setRow = page.locator("li", { hasText: SET_TITLE });
    await setRow.getByRole("button", { name: "Löschen" }).click();
    await setRow.getByRole("button", { name: "Ja, löschen" }).click();
    await expect(page.getByText(SET_TITLE)).toHaveCount(0);

    await page.goto("/faecher");
    await page.getByText(SUBJECT_RENAMED).click();
    await page.getByRole("button", { name: "Fach löschen" }).click();
    await expect(page.getByText(SUBJECT_RENAMED)).toHaveCount(0);
  });
});
