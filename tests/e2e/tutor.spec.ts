import { expect, test, type Page } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Tutor (T-02, umgebaut in T-07).
 *
 * Der Modellaufruf selbst läuft hier **nicht**: In CI fehlt der
 * `ANTHROPIC_API_KEY` absichtlich (wie beim Foto-Import, V-03b). Geprüft wird
 * deshalb ohne echte Antwort:
 * - Für ein Elternteil gibt es hier nichts (ADR 0010 D2) – nur der Hinweis.
 * - Die Übersicht (`/tutor`) trägt Fachwahl, Einstieg und die Historie.
 * - Ein gespeichertes Gespräch (`/tutor/[id]`) rendert vollständig, hat einen
 *   Weg zurück zur Übersicht und den festen Hinweis „Allgemeinwissen“.
 * - Diktat füllt das Eingabefeld, Vorlesen merkt sich seinen Zustand.
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

/** Tutor-Verläufe sieht nur das Kind (ADR 0004 D4) – in die Kind-Sicht wechseln. */
async function alsMia(page: Page) {
  await page.goto("/heute");
  await page.getByLabel("Kind").selectOption({ label: "Mia" });
  const kind = page.getByRole("button", { name: "Kind" });
  await kind.click();
  await expect(kind).toHaveAttribute("aria-pressed", "true");
}

test("Ein Elternteil sieht keinen Chat, nur den Hinweis", async ({ page }) => {
  await page.goto("/tutor");
  await expect(page.getByRole("heading", { name: "Tutor", level: 1 })).toBeVisible();
  await expect(page.getByText(/Lernseite deines Kindes/)).toBeVisible();
});

test.describe("Tutor als Kind", () => {
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
    // Die Tutor-Antwort ist absichtlich lang: Nur mit überlaufendem Inhalt
    // lässt sich prüfen, dass der Composer klebt und der ↓-Knopf erscheint.
    // Und sie trägt Markdown (**fett**, Liste), damit der T-08-Renderer im
    // E2E einen echten Fall bekommt.
    const langeAntwort =
      `${PREFIX} Ein **reflexives Verb** wirkt auf die handelnde Person zurueck.\n\n` +
      "Merke dir:\n\n- Das Pronomen passt zur Person\n- Es steht vor dem Verb\n\n" +
      "Beispielzeile fuer genug Hoehe im Gespraech.\n".repeat(40);
    await admin`
      insert into tutor_message (student_id, session_id, role, content) values
        (${MIA}, ${sessionId}, 'nutzer', ${PREFIX + " Ich verstehe die reflexiven Verben nicht."}),
        (${MIA}, ${sessionId}, 'tutor',  ${langeAntwort})`;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin`delete from tutor_session where title like ${PREFIX + "%"}`;
    await admin`delete from tutor_message where content like ${PREFIX + "%"}`;
    await admin.end();
  });

  test("die Übersicht trägt Fachwahl, Einstieg und die Historie", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    await page.goto("/tutor");

    await expect(page.getByLabel("Fach")).toContainText("Französisch");
    await expect(page.getByText("Freie Frage")).toBeVisible();
    await expect(page.getByText("Verstehen")).toBeVisible();
    await expect(page.getByRole("link", { name: "Gespräch beginnen" })).toBeVisible();

    // Die Historie steht auf der Übersicht – nicht mehr unter dem Gespräch.
    await expect(page.getByRole("link", { name: new RegExp(PREFIX) })).toBeVisible();
  });

  test("ein gespeichertes Gespräch rendert und führt zurück zur Übersicht", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");
    if (!admin || !sessionId) throw new Error("Seed fehlgeschlagen – TEST_MIGRATION_DATABASE_URL?");

    await alsMia(page);
    await page.goto(`/tutor/${sessionId}`);

    // Kontext-Chip mit dem Fach (§15) – ohne „ohne Thema“-Platzhalter.
    await expect(page.getByText("Französisch", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/ohne Thema/)).toHaveCount(0);
    await expect(page.getByText(/Ich verstehe die reflexiven Verben nicht/)).toBeVisible();
    await expect(page.getByText(/wirkt auf die handelnde Person zurueck/)).toBeVisible();
    await expect(page.getByText(/Allgemeinwissen — noch ohne dein Material/).first()).toBeVisible();

    // Markdown wird gerendert, nicht wörtlich angezeigt (T-08).
    await expect(page.getByText("reflexives Verb")).toHaveJSProperty("tagName", "STRONG");
    await expect(page.getByText(/\*\*reflexives Verb\*\*/)).toHaveCount(0);
    const punkt = page.getByText("Das Pronomen passt zur Person", { exact: true });
    await expect(punkt).toBeVisible();
    await expect(punkt).toHaveJSProperty("tagName", "LI");

    // Aktionsleiste unter der Antwort (T-10): Kopieren und Vorlesen als
    // Icon-Knöpfe. „Vorlesen“ steht beim Öffnen auf Play – ein gespeichertes
    // Gespräch spricht nicht von selbst los, und nichts hängt auf „Stopp“.
    await expect(page.getByRole("button", { name: "Antwort kopieren" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Vorlesen" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Vorlesen anhalten" })).toHaveCount(0);
    const schalter = page.getByRole("button", { name: /Antworten vorlesen/ });
    await expect(schalter).toHaveAttribute("aria-pressed", "false");
    await schalter.click();
    await expect(schalter).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: /Antworten vorlesen/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Der Weg zurück (primitives.tsx: jede Unterseite trägt einen `back`).
    await page.getByRole("main").getByRole("link", { name: "Gespräche" }).click();
    await expect(page).toHaveURL(/\/tutor$/);
    await expect(page.getByRole("link", { name: "Gespräch beginnen" })).toBeVisible();
  });

  test("Kopfzeile und Eingabefeld bleiben beim Scrollen angeheftet", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");
    if (!sessionId) throw new Error("Seed fehlgeschlagen – TEST_MIGRATION_DATABASE_URL?");

    await alsMia(page);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(`/tutor/${sessionId}`);

    const feld = page.getByRole("textbox");
    await expect(feld).toBeVisible();
    // Keine „Tutor“-Überschrift mehr (T-07b) – der aktive Reiter sagt das.
    await expect(page.getByRole("heading", { name: "Tutor", level: 1 })).toHaveCount(0);

    // Der Inhalt läuft über – sonst prüft der Rest nichts.
    const scrollbar = await page.evaluate(() => {
      const m = document.querySelector("main");
      return m ? m.scrollHeight > m.clientHeight + 40 : false;
    });
    expect(scrollbar).toBe(true);

    // T-10: Das Gespräch geht **am Ende** auf, nicht am Anfang – dort, wo
    // man weiterliest. Gemessen am Abstand zum unteren Rand von `main`.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const m = document.querySelector("main");
          return m ? m.scrollHeight - m.scrollTop - m.clientHeight : 0;
        }),
      )
      .toBeLessThanOrEqual(64);

    // Mitten in die Antwort scrollen: Der Zurück-Weg und der Fach-Chip bleiben
    // oben in `main` kleben (vorher scrollten sie mit weg).
    await page.evaluate(() => document.querySelector("main")?.scrollTo({ top: 300 }));
    await page.waitForTimeout(150);
    const kopfLuecke = await page.evaluate(() => {
      const kopf = document.querySelector('a[href="/tutor"]')?.closest("div");
      const main = document.querySelector("main");
      if (!kopf || !main) return -1;
      return Math.abs(kopf.getBoundingClientRect().top - main.getBoundingClientRect().top);
    });
    expect(kopfLuecke).toBeLessThan(2);
    await expect(page.getByRole("main").getByText("Französisch", { exact: true })).toBeInViewport();

    // Nach ganz oben: Das Eingabefeld bleibt sichtbar (vorher wanderte es weg) …
    await page.evaluate(() => document.querySelector("main")?.scrollTo({ top: 0 }));
    await expect(feld).toBeInViewport();

    // … und der Sprung ans Ende erscheint.
    const zumEnde = page.getByRole("button", { name: "Zum Ende springen" });
    await expect(zumEnde).toBeVisible();
    await zumEnde.click();
    await expect(zumEnde).toHaveCount(0);

    // Und es klebt genau auf der Fußleiste, ohne deren Höhe zu kennen.
    const luecke = await page.evaluate(() => {
      const composer = document.querySelector("textarea")?.closest("form")?.parentElement;
      const nav = document.querySelector('nav[aria-label="Bereiche"]');
      if (!composer || !nav) return -1;
      return Math.abs(composer.getBoundingClientRect().bottom - nav.getBoundingClientRect().top);
    });
    expect(luecke).toBeLessThan(3);
  });

  test("Diktat füllt das Feld und stoppt von selbst (T-02b)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    // Die Web Speech API gibt es im Test-Browser nicht – ein minimaler Stub
    // an ihrer Stelle. Er liefert nach dem Start ein Ergebnis und beendet
    // sich dann selbst, wie es die echte API bei `continuous = false` tut.
    // Bewusst ohne Klassensyntax mit privaten Feldern: Playwright transpiliert
    // das Init-Skript, und die Babel-Helfer dafür gibt es im Seitenkontext
    // nicht („_classPrivateMethodInitSpec is not defined“).
    await page.addInitScript(() => {
      type Rueckruf = { onresult: ((e: unknown) => void) | null; onend: (() => void) | null };
      function FakeRecognition(this: Rueckruf) {
        this.onresult = null;
        this.onend = null;
      }
      FakeRecognition.prototype.start = function (this: Rueckruf) {
        const alt = { transcript: "wie kürzt man Brüche" };
        const eintrag = { isFinal: true, length: 1, item: () => alt, 0: alt };
        const results = { length: 1, item: () => eintrag, 0: eintrag };
        setTimeout(() => {
          if (this.onresult) this.onresult({ resultIndex: 0, results });
          if (this.onend) this.onend();
        }, 30);
      };
      FakeRecognition.prototype.stop = function (this: Rueckruf) {
        if (this.onend) this.onend();
      };
      FakeRecognition.prototype.abort = function () {};
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    });

    await alsMia(page);
    await page.goto("/tutor");
    await page.getByRole("link", { name: "Gespräch beginnen" }).click();
    await expect(page).toHaveURL(/\/tutor\/neu/);

    const mikro = page.getByRole("button", { name: "Diktieren" });
    await expect(mikro).toBeVisible();
    await mikro.click();

    // Erste Nutzung: der Hinweis auf den Datenweg (ADR 0011 D1).
    await expect(
      page.getByText(/schickt dein Browser die Aufnahme an seinen Hersteller/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Verstanden, los" }).click();

    // Der erkannte Text landet im Feld – und bleibt dort editierbar.
    await expect(page.getByRole("textbox")).toHaveValue(/wie kürzt man Brüche/);
    // Der Stub beendet sich selbst → „hört zu“ ist wieder weg.
    await expect(page.getByText(/tutr hört zu/)).toHaveCount(0);
    // Erst jetzt ist Absenden möglich. Der Knopf heißt seit T-12 „Senden“,
    // nicht mehr „Frage senden“: Derselbe Composer trägt jetzt auch den
    // Hausaufgaben-Dialog, und dort schickt man einen Versuch, keine Frage.
    await expect(page.getByRole("button", { name: "Senden" })).toBeEnabled();
  });

  test("das Eingabefeld wächst mit dem Text und deckelt sich dann (V-13)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    await page.goto("/tutor");
    await page.getByRole("link", { name: "Gespräch beginnen" }).click();
    await expect(page).toHaveURL(/\/tutor\/neu/);

    const feld = page.getByRole("textbox");
    await expect(feld).toBeVisible();

    // Gemessen wird die Hülle (der Grid-Container), nicht das Feld selbst:
    // Das Feld streckt sich in seiner Gitterzelle auf deren – ggf. über die
    // Deckelhöhe hinausgehende – Größe; sichtbar gedeckelt und scrollbar ist
    // die Hülle (`max-h-40 overflow-y-auto`).
    const huelle = () =>
      page.evaluate(() => {
        const feld = document.querySelector("textarea");
        const h = feld?.parentElement;
        return h ? { hoehe: h.clientHeight, scrollt: h.scrollHeight > h.clientHeight + 1 } : null;
      });

    const leer = await huelle();
    expect(leer?.scrollt).toBe(false);

    // **Drei Zeilen müssen ganz hineinpassen** (T-12): Der Deckel liegt
    // genau dort, und ein Pixel zu wenig erzeugte eine Bildlaufleiste für
    // nichts – beim Bauen einmal passiert, deshalb hier festgehalten.
    await feld.fill("Zeile 1\nZeile 2\nZeile 3");
    await expect
      .poll(async () => (await huelle())?.hoehe ?? 0)
      .toBeGreaterThan((leer?.hoehe ?? 0) + 20);
    await expect.poll(async () => (await huelle())?.scrollt ?? false).toBe(false);

    // Ab der vierten Zeile wächst nichts mehr, es scrollt – nichts wird
    // wortlos abgeschnitten.
    await feld.fill(Array.from({ length: 20 }, (_, i) => `Zeile ${i + 1}`).join("\n"));
    await expect.poll(async () => (await huelle())?.hoehe ?? 0).toBeLessThanOrEqual(90);
    await expect.poll(async () => (await huelle())?.scrollt ?? false).toBe(true);
  });

  test("das Plus-Menü bietet Kamera und Mediathek, der Pegel steht im Feld (T-12)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    await page.goto("/tutor");
    await page.getByRole("link", { name: "Gespräch beginnen" }).click();
    await expect(page).toHaveURL(/\/tutor\/neu/);

    // Zu ist zu: Das Menü darf die Tastenreihe nicht dauerhaft verdecken.
    await expect(page.getByRole("button", { name: "Foto aufnehmen" })).toHaveCount(0);

    await page.getByRole("button", { name: "Anhang hinzufügen" }).click();
    await expect(page.getByRole("button", { name: "Foto aufnehmen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Foto auswählen" })).toBeVisible();

    // Zwei Eingabefelder mit demselben `accept`, eines mit `capture` – am
    // Handy öffnet das eine die Kamera, das andere die Mediathek (ADR 0007 D1).
    const felder = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].map((i) => ({
        accept: i.accept,
        capture: i.getAttribute("capture"),
      })),
    );
    expect(felder).toEqual([
      { accept: "image/*", capture: "environment" },
      { accept: "image/*", capture: null },
    ]);

    // Ein Klick daneben schließt das Menü wieder.
    await page.getByRole("textbox").click();
    await expect(page.getByRole("button", { name: "Foto aufnehmen" })).toHaveCount(0);

    // Der Pegel sitzt im Feld und nennt sein Fenster – „Diese Stunde" gibt
    // es nicht mehr (S-03e), und auf der Übersicht steht er auch nicht mehr.
    const pegel = page.getByRole("img", { name: /genutzt/ });
    await expect(pegel).toBeVisible();
    await expect(pegel).toHaveAttribute("aria-label", /^(Heute|Diese Woche): \d+ % genutzt$/);

    await page.goto("/tutor");
    await expect(page.getByRole("img", { name: /genutzt/ })).toHaveCount(0);
  });
});
