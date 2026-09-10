import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Sets und Vokabelverwaltung (V-03a, ADR 0007 D2–D4).
 *
 * Ein einziger durchgehender Weg statt vieler kleiner Tests: Set anlegen →
 * einfügen → korrigieren → löschen → Set löschen. Genau so benutzt man die
 * Seite auch, und jeder Schritt braucht das Ergebnis des vorigen.
 *
 * Zwei Dinge lassen sich nur hier prüfen, nicht in den Unit-Tests:
 * - Das Einfügen klassifiziert **gegen den wachsenden Bestand**, nicht gegen
 *   eine Momentaufnahme vom Anfang. Dieselbe Zeile zweimal im selben Text
 *   wird verknüpft, nicht verdoppelt.
 * - „Set löschen" nimmt nur das Set mit. Die Vokabeln selbst zählen wir
 *   danach direkt in der Datenbank nach – im UI wären sie schlicht
 *   unsichtbar, was den Unterschied zwischen „erhalten" und „gelöscht"
 *   verwischt.
 *
 * Jeder Lauf schreibt unter einem eigenen Präfix und räumt hinterher per
 * Migrationsrolle auf, damit wiederholte Läufe dasselbe Ergebnis liefern und
 * die Seed-Daten unberührt bleiben. Nur Chromium (der Rollenwechsel bricht
 * unter WebKit den Dev-Server ab, siehe `practice.spec.ts`), nur mit
 * Datenbank (`RUN_DB_TESTS=1`).
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

/**
 * Ein Präfix je Worker – so kollidieren weder Wiederholungen noch die beiden
 * Playwright-Projekte, die parallel in eigenen Prozessen laufen. Der
 * Zufallsanteil ist nötig: Zwei Worker können in derselben Millisekunde
 * starten, und das Aufräumen am Ende löscht alles unter dem eigenen Präfix.
 */
const PREFIX = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const SET_TITLE = `${PREFIX} Unité`;
const ALPHA = `${PREFIX}alpha`;
const BETA = `${PREFIX}beta`;
const GAMMA = `${PREFIX}gamma`;

test.describe("Vokabelverwaltung", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;

  test.beforeAll(() => {
    // Immer die Test-Datenbank, nie die Produktive (F-13) – siehe test-db.ts.
    // `undefined`, wenn keine konfiguriert ist: Dann überspringt sich der
    // Test selbst, statt auf eine andere Datenbank auszuweichen.
    admin = adminClient();
  });

  test.afterAll(async () => {
    if (!admin) return;
    // Direkt über die Migrationsrolle, nicht über die UI: Aufräumen soll auch
    // dann laufen, wenn der Test vorher gescheitert ist.
    // `vocab_item` nimmt `vocab_set_item`, `card` und `review` mit (V-01).
    await admin`delete from vocab_item where term like ${PREFIX + "%"}`;
    await admin`delete from vocab_set where title like ${PREFIX + "%"}`;
    await admin.end();
  });

  test("anlegen, einfügen, korrigieren, löschen – und das Set löschen lässt die Vokabeln stehen", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");
    if (!admin) throw new Error("TEST_MIGRATION_DATABASE_URL fehlt – siehe test-db.ts.");

    // Schreiben darf nur das Kind (ADR 0004 D4) – ohne Rollenwechsel bliebe
    // die ganze Verwaltung unsichtbar.
    await page.goto("/heute");
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    // --- Set anlegen ------------------------------------------------------
    await page.goto("/faecher/vokabeln");
    await page.getByRole("button", { name: "Neues Set anlegen" }).click();
    await page.getByLabel("Name").fill(SET_TITLE);
    await page.getByRole("button", { name: "Anlegen" }).click();

    const setLink = page.getByRole("link", { name: new RegExp(SET_TITLE) });
    await expect(setLink).toBeVisible({ timeout: 10_000 });
    await setLink.click();
    await expect(page.getByText("Noch keine Vokabeln in diesem Set.")).toBeVisible();

    // --- Der Foto-Weg ist da (V-03b) ---------------------------------------
    // Der Vision-Aufruf selbst läuft hier nicht: In CI fehlt der
    // ANTHROPIC_API_KEY absichtlich, und ein echtes Bild durch die API zu
    // schicken wäre ein Test der Erkennung, nicht der Anwendung. Geprüft
    // wird, dass der Weg existiert, beide Eingaben anbietet (ADR 0007 D1:
    // ein Feld, mit und ohne `capture`) und die Zusage aus D6 sichtbar
    // macht. Dass Erkennung, Konfidenz-Markierung und Einfügen zusammen
    // funktionieren, ist von Hand gegen die echte API geprüft.
    await page.getByRole("button", { name: "Foto" }).click();
    // Wortlaut seit V-03c (Minigalerie, #41): „Die Fotos" (Mehrzahl) – mehrere
    // Bilder zählen jetzt einzeln, siehe vocab-list.tsx.
    await expect(page.getByText(/Fotos werden nicht gespeichert/)).toBeVisible();
    const dateifelder = page.locator('input[type="file"]');
    await expect(dateifelder).toHaveCount(2);
    await expect(page.locator('input[type="file"][capture]')).toHaveCount(1);
    await page.getByRole("button", { name: "Abbrechen" }).click();

    // --- Einfügen: alle vier Fälle in einem Text --------------------------
    await page.getByRole("button", { name: "Einfügen" }).click();
    await page.locator("textarea").fill(
      [
        `${ALPHA}\tgehen`, // neu
        `${BETA}\tkommen`, // neu
        `${ALPHA}\tgehen`, // dieselbe Zeile noch einmal → verknüpfen, nicht verdoppeln
        `${BETA}\tfahren`, // gleiches Wort, andere Übersetzung → nicht zusammenführen (D4)
        GAMMA, // kein Trennzeichen → als unfertige Zeile anlegen
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Übernehmen" }).click();

    await expect(
      page.getByText("2 neu, 1 schon vorhanden, nur verknüpft, 2 zu prüfen."),
    ).toBeVisible({ timeout: 15_000 });

    // Vier Einträge, nicht fünf: die Wiederholung wurde verknüpft.
    const [{ count: itemCount }] = await admin<{ count: string }[]>`
      select count(*)::text as count from vocab_item where term like ${PREFIX + "%"}`;
    expect(Number(itemCount)).toBe(4);

    // --- Was zu prüfen ist, steht oben (D2) -------------------------------
    // Leeres Feld (gamma) plus zweimal dasselbe Wort mit verschiedenen
    // Übersetzungen (beta) – beides abgeleitet, nicht gespeichert.
    await expect(page.getByText("3 Zeilen solltest du prüfen.")).toBeVisible();
    // `main` schließt die Fußleiste aus – die ist auch eine Liste.
    const rows = page.getByRole("main").locator("ul > li");
    await expect(rows.first().getByText("prüfen")).toBeVisible();

    // --- Korrigieren: Lücke füllen ----------------------------------------
    await page.getByRole("button", { name: new RegExp(GAMMA) }).click();
    await page.getByLabel("Übersetzung").fill("die Katze");
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByText("2 Zeilen solltest du prüfen.")).toBeVisible({ timeout: 10_000 });

    // --- Löschen: eine Zeile, die gar keine Vokabel ist --------------------
    await page.getByRole("button", { name: new RegExp(GAMMA) }).click();
    await page.getByRole("button", { name: "Das ist keine Vokabel – löschen" }).click();
    await expect(page.getByRole("button", { name: new RegExp(GAMMA) })).toHaveCount(0, {
      timeout: 10_000,
    });

    // --- Eine Ebene höher, ohne Umweg über die Fußleiste -------------------
    // Die Fußleiste kennt nur die fünf Bereiche; ohne diesen Link käme man aus
    // einer Unterseite nur über /faecher wieder heraus.
    const inhalt = page.getByRole("main");
    await inhalt.getByRole("link", { name: "Vokabelsets" }).click();
    await expect(page.getByRole("link", { name: new RegExp(SET_TITLE) })).toBeVisible({
      timeout: 10_000,
    });
    // `main` schließt die Fußleiste aus – die trägt auch einen „Fächer"-Link,
    // und genau der Umweg soll hier ja nicht geprüft werden.
    await inhalt.getByRole("link", { name: "Fächer" }).click();
    await expect(page.getByRole("heading", { name: "Fächer", level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // --- Set löschen, „Nur das Set": die Vokabeln bleiben (V-03a) --------
    // Seit V-03d fragt das Löschen, weil alle drei Vokabeln in keinem
    // anderen Set stecken. „Nur das Set" lässt sie stehen.
    await page.goto("/faecher/vokabeln");
    const row = page.getByRole("listitem").filter({ hasText: SET_TITLE });
    await row.getByRole("button", { name: "Löschen" }).click();
    await expect(row.getByText(/Vokabeln stecken in keinem anderen Set/)).toBeVisible();
    await row.getByRole("button", { name: "Nur das Set" }).click();
    await expect(page.getByRole("link", { name: new RegExp(SET_TITLE) })).toHaveCount(0, {
      timeout: 10_000,
    });

    const [{ count: rest }] = await admin<{ count: string }[]>`
      select count(*)::text as count from vocab_item where term like ${PREFIX + "%"}`;
    expect(Number(rest)).toBe(3);

    // --- „Ohne Set": die drei Waisen sind erreichbar (V-03d) ------------
    const ohneSet = page.getByRole("link", { name: /Ohne Set/ }).first();
    await expect(ohneSet).toBeVisible({ timeout: 10_000 });
    await expect(ohneSet).toContainText("3 Vokabeln");
    await ohneSet.click();

    await expect(page.getByRole("heading", { name: "Ohne Set", level: 1 })).toBeVisible();
    const inhaltOhneSet = page.getByRole("main");
    await expect(inhaltOhneSet.locator("ul > li")).toHaveCount(3);

    // Eine Waise vollständig löschen (kaskadiert auf Karten, Reviews).
    await page.getByRole("button", { name: new RegExp(ALPHA) }).click();
    const loeschen = page.getByRole("button", { name: "Vokabel löschen" });
    await expect(loeschen).toBeVisible();
    await loeschen.click();

    await expect(inhaltOhneSet.locator("ul > li")).toHaveCount(2, { timeout: 10_000 });
    const db = admin;
    await expect
      .poll(
        async () =>
          Number(
            (
              await db<{ count: string }[]>`
                select count(*)::text as count from vocab_item where term like ${PREFIX + "%"}`
            )[0]!.count,
          ),
        { timeout: 10_000 },
      )
      .toBe(2);
  });
});
