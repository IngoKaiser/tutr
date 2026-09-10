import { expect, test } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Tutor-Chat (T-02, Konzept §4/§15, ADR 0010).
 *
 * Der Modellaufruf selbst läuft hier **nicht**: In CI fehlt der
 * `ANTHROPIC_API_KEY` absichtlich (wie beim Foto-Import, V-03b). Geprüft wird
 * deshalb ohne echte Antwort:
 * - Für ein Elternteil gibt es hier nichts (ADR 0010 D2) – nur der Hinweis.
 * - Ein vorab in die Datenbank gelegtes Gespräch rendert für das Kind
 *   vollständig: Kontext-Chip mit Fach, beide Nachrichten, der feste Hinweis
 *   „Allgemeinwissen" unter der Tutor-Antwort (ADR 0010 D5).
 * - Ein früheres Gespräch ist über die Liste wieder erreichbar.
 *
 * Der Sende-Weg (`POST /api/tutor`, Streaming, Sprachwächter, Rate Limit) ist
 * durch die Unit- und DB-Tests abgedeckt und von Hand gegen die echte API
 * geprüft.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

// Seed-IDs (siehe src/db/seed-ids.ts): Mia und ihr Fach Französisch.
const MIA = "00000000-0000-4000-8000-00000000d003";
const FRANZOESISCH = "00000000-0000-4000-8000-00000000d020";

const PREFIX = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

test("Ein Elternteil sieht keinen Chat, nur den Hinweis", async ({ page }) => {
  await page.goto("/tutor");
  await expect(page.getByRole("heading", { name: "Tutor", level: 1 })).toBeVisible();
  await expect(page.getByText(/Lernseite deines Kindes/)).toBeVisible();
});

test.describe("Tutor-Chat als Kind", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  let admin: postgres.Sql | undefined;
  let sessionId: string | undefined;

  test.beforeAll(async () => {
    admin = adminClient();
    if (!admin) return;
    const [row] = await admin<{ id: string }[]>`
      insert into tutor_session (student_id, subject_id, title, entry_point)
      values (${MIA}, ${FRANZOESISCH}, ${PREFIX + " Reflexive Verben"}, 'verstehen')
      returning id`;
    sessionId = row!.id;
    await admin`
      insert into tutor_message (student_id, session_id, role, content) values
        (${MIA}, ${sessionId}, 'nutzer', ${PREFIX + " Ich verstehe die reflexiven Verben nicht."}),
        (${MIA}, ${sessionId}, 'tutor',  ${PREFIX + " Ein reflexives Verb wirkt auf die handelnde Person zurueck."})`;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin`delete from tutor_session where title like ${PREFIX + "%"}`;
    await admin`delete from tutor_message where content like ${PREFIX + "%"}`;
    await admin.end();
  });

  test("ein gespeichertes Gespräch rendert vollständig und ist über die Liste erreichbar", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");
    if (!admin || !sessionId) throw new Error("Seed fehlgeschlagen – TEST_MIGRATION_DATABASE_URL?");

    // Tutor-Verläufe sieht nur das Kind (ADR 0004 D4) – in die Kind-Sicht wechseln.
    await page.goto("/heute");
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    const kind = page.getByRole("button", { name: "Kind" });
    await kind.click();
    await expect(kind).toHaveAttribute("aria-pressed", "true");

    // --- Das gespeicherte Gespräch ---------------------------------------
    await page.goto(`/tutor?s=${sessionId}`);
    // Kontext-Chip mit dem Fach (§15).
    await expect(page.getByText("Französisch", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Ich verstehe die reflexiven Verben nicht/)).toBeVisible();
    await expect(page.getByText(/wirkt auf die handelnde Person zurueck/)).toBeVisible();
    // Der feste Herkunfts-Hinweis unter der Tutor-Antwort (ADR 0010 D5).
    await expect(page.getByText(/Allgemeinwissen — noch ohne dein Material/).first()).toBeVisible();

    // --- Über „Frühere Gespräche" wieder hinfinden ---------------------
    // Titel mit dem Worker-eigenen Präfix suchen: Bei parallelen Projekten
    // legt jeder Worker eine eigene „Reflexive Verben"-Session an, und RLS
    // zeigt Mia alle.
    await page.goto("/tutor");
    const eintrag = page.getByRole("link", { name: new RegExp(PREFIX) });
    await expect(eintrag).toBeVisible();
    await eintrag.click();
    await expect(page).toHaveURL(new RegExp(`/tutor\\?s=${sessionId}`));
    await expect(page.getByText(/wirkt auf die handelnde Person zurueck/)).toBeVisible();
  });

  test("die Startmaske bietet Fach und beide Einstiege an", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await page.goto("/heute");
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    const kind = page.getByRole("button", { name: "Kind" });
    await kind.click();
    await expect(kind).toHaveAttribute("aria-pressed", "true");

    await page.goto("/tutor");
    await expect(page.getByLabel("Fach")).toBeVisible();
    await expect(page.getByLabel("Fach")).toContainText("Französisch");
    await expect(page.getByText("Freie Frage")).toBeVisible();
    await expect(page.getByText("Verstehen")).toBeVisible();
  });
});
