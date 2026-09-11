import { expect, test, type Page } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "./test-db";

/**
 * Tutor (T-02, umgebaut in T-07, T-13).
 *
 * Der Modellaufruf selbst läuft hier **nicht**: In CI fehlt der
 * `ANTHROPIC_API_KEY` absichtlich (wie beim Foto-Import, V-03b) – und die
 * DB-gestützten Tests in diesem Block laufen ohnehin nur lokal
 * (`RUN_DB_TESTS=1`, CI setzt das nie). Geprüft wird deshalb ohne echte
 * Antwort und ohne zu senden:
 * - Für ein Elternteil gibt es hier nichts (ADR 0010 D2) – nur der Hinweis.
 * - Die Übersicht (`/tutor`) zeigt seit T-13 (ADR 0013 D1) direkt das
 *   Eingabefeld statt eines Formulars davor, und daneben die Historie.
 * - Ein gespeichertes Gespräch (`/tutor/[id]`) rendert vollständig, hat einen
 *   Weg zurück zur Übersicht und den festen Hinweis „Allgemeinwissen“.
 * - Diktat füllt das Eingabefeld, Vorlesen merkt sich seinen Zustand.
 *
 * Der Sende-Weg (`POST /api/tutor`, Streaming, Sprachwächter, Rate Limit,
 * seit T-13 die Fach-Zuordnung) ist durch die Unit- und DB-Tests abgedeckt
 * und von Hand gegen die echte API geprüft.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

// Seed-IDs (siehe src/db/seed-ids.ts): Mia und ihr Fach Französisch.
const MIA = "00000000-0000-4000-8000-00000000d003";
const FRANZOESISCH = "00000000-0000-4000-8000-00000000d020";

const PREFIX = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Die Gesprächszeilen einer Liste – ohne den Weg ins Archiv, der als Link
 * daneben steht (T-19c). Gezählt wird über `href`, nicht über den Text: Die
 * Titel gehören anderen Tests, die parallel laufen.
 */
function gespraechsZeilen(page: Page) {
  return page.getByRole("main").locator('a[href^="/tutor/"]:not([href="/tutor/gespraeche"])');
}

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

  test("die Übersicht zeigt das Eingabefeld direkt, ohne Formular davor (ADR 0013 D1)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    await page.goto("/tutor");

    // Keine Fachwahl, keine Einstiegs-Kacheln, kein „Gespräch beginnen“ mehr
    // – der Tutor beginnt mit dem Dialog, das Fach ordnet der Server zu.
    await expect(page.getByLabel("Fach")).toHaveCount(0);
    await expect(page.getByText("Freie Frage")).toHaveCount(0);
    await expect(page.getByText("Verstehen", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Gespräch beginnen" })).toHaveCount(0);

    // Stattdessen direkt das Eingabefeld …
    await expect(page.getByRole("textbox")).toBeVisible();

    // … und die Historie steht daneben, genau wie zuvor unter dem Formular.
    //
    // **Welches** Gespräch dort steht, sagt dieser Test nicht mehr: `/tutor`
    // zeigt seit T-19c nur die letzten sechs (ADR 0014 D3), und wie viele
    // Gespräche die parallel laufenden Specs für Mia gerade anlegen, ist
    // nicht vorhersagbar. Dass das eigene wiederzufinden ist, prüft der
    // Archiv-Block unten.
    await expect(page.getByText("Zuletzt")).toBeVisible();
    await expect(gespraechsZeilen(page).first()).toBeVisible();
  });

  test("Kopfzeile, Scrollbereich und Hausaufgaben-Weg auf der Übersicht (T-16)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("/tutor");

    // Der Tutor war die einzige Fußleisten-Wurzel ohne Titel – jetzt steht
    // er da, solange kein Gespräch läuft.
    await expect(page.getByRole("heading", { name: "Tutor", level: 1 })).toBeVisible();

    // Der Scrollbereich reicht bis an den Rand von `main`: Sonst zeichnet
    // iOS seine überlagernde Bildlaufleiste über die Karten statt daneben.
    const raender = await page.evaluate(() => {
      const verlauf = document.querySelector("main div.overflow-y-auto");
      const main = document.querySelector("main");
      if (!verlauf || !main) return null;
      const v = verlauf.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      return { links: Math.abs(v.left - m.left), rechts: Math.abs(v.right - m.right) };
    });
    expect(raender).toEqual({ links: 0, rechts: 0 });

    // Der Weg in die Hausaufgabe führt seit T-13 nicht mehr über eine Kachel
    // auf dieser Seite – ohne ihn im Plus-Menü gäbe es aus dem Tutor heraus
    // gar keinen mehr (nur noch über „Heute").
    await page.getByRole("button", { name: "Anhang hinzufügen" }).click();
    await expect(page.getByRole("link", { name: "Hausaufgabe fotografieren" })).toHaveAttribute(
      "href",
      "/tutor/hausaufgabe/neu",
    );
  });

  test("frühere Gespräche lassen sich löschen, mit Rückgängig-Fenster (T-15)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");
    if (!admin) throw new Error("Seed fehlgeschlagen – TEST_MIGRATION_DATABASE_URL?");

    // Ein eigenes, hier angelegtes Gespräch – nicht das gemeinsame `sessionId`
    // aus `beforeAll`, das andere Tests in dieser Datei noch brauchen. Dazu
    // eine Hausaufgaben-Session: Sie hängt an derselben `tutor_session`-Zeile
    // und muss sich genauso löschen lassen ("inklusive Hausaufgaben-Sessions,
    // die derselben Liste angehören", PLAN.md T-15).
    const titel = `${PREFIX} Zum Löschen`;
    const haTitel = `${PREFIX} Hausaufgabe zum Löschen`;
    const [row] = await admin<{ id: string }[]>`
      insert into tutor_session (student_id, subject_id, title, entry_point)
      values (${MIA}, ${FRANZOESISCH}, ${titel}, 'freie_frage')
      returning id`;
    await admin`
      insert into tutor_message (student_id, session_id, role, content)
      values (${MIA}, ${row!.id}, 'nutzer', ${titel})`;
    await admin`
      insert into tutor_session (student_id, subject_id, title, entry_point)
      values (${MIA}, ${FRANZOESISCH}, ${haTitel}, 'hausaufgabe')`;

    await alsMia(page);
    await page.goto("/tutor");

    const rueckgaengig = page.getByRole("button", { name: "Rückgängig" });

    // Die Hausaufgaben-Session löschen – derselbe Weg, andere Zielroute –
    // und gleich per Rückgängig zurückholen, damit danach wieder nur eine
    // Löschung gleichzeitig schwebt (die `getByRole`-Suchen unten sind sonst
    // nicht mehr eindeutig).
    const haZeile = page.getByRole("link", { name: new RegExp(haTitel) });
    await expect(haZeile).toBeVisible();
    await expect(haZeile).toHaveAttribute("href", /\/tutor\/hausaufgabe\//);
    await page
      .locator("li", { has: haZeile })
      .locator("button", { hasText: "Löschen" })
      .dispatchEvent("click");
    await expect(haZeile).toHaveCount(0);
    await expect(page.getByText(/gelöscht/)).toContainText(haTitel);
    await rueckgaengig.click();
    await expect(haZeile).toBeVisible();
    await expect(rueckgaengig).toHaveCount(0);

    const zeile = page.getByRole("link", { name: new RegExp(titel) });
    await expect(zeile).toBeVisible();

    // Der „Löschen“-Knopf (`SwipeRow`, V-11) liegt hinter der Zeile und wird
    // erst beim echten Wischen sichtbar. `.click()` – auch mit `force` – trifft
    // an seinen Koordinaten trotzdem den `Link` obendrüber, denn das Browser-
    // Hit-Testing für einen echten Klick schaut nicht auf Playwrights
    // Sichtbarkeitsprüfung, sondern auf das oberste Element an der Stelle.
    // `dispatchEvent("click")` löst das `onClick` direkt am Knoten aus, ohne
    // über Bildschirmkoordinaten zu gehen – wie ein echter Wisch es am Ende
    // auch tut (`SwipeRow`s Knopf hat `onClick`, keinen Pointer-Handler).
    // Über `getByRole` ist der Knopf ohnehin nicht zu finden: Solange die
    // Zeile geschlossen ist, steht `aria-hidden="true"` daran, und die Rolle
    // fällt aus dem Accessibility-Baum.
    const zeilenElement = page.locator("li", { has: zeile });
    await zeilenElement.locator("button", { hasText: "Löschen" }).dispatchEvent("click");

    await expect(zeile).toHaveCount(0);
    await expect(rueckgaengig).toBeVisible();
    await expect(page.getByText(/gelöscht/)).toContainText(titel);

    // Rückgängig holt die Zeile zurück.
    await rueckgaengig.click();
    await expect(zeile).toBeVisible();
    await expect(rueckgaengig).toHaveCount(0);

    // Ohne Rückgängig verschwindet sie nach der Verzögerung dauerhaft – der
    // Timer selbst ist in `use-deferred-delete.test.ts` durchgetestet, hier
    // reicht die Bestätigung nach einem Reload.
    await zeilenElement.locator("button", { hasText: "Löschen" }).dispatchEvent("click");
    await expect(zeile).toHaveCount(0);
    await page.waitForTimeout(5200);
    await page.reload();
    await expect(page.getByRole("link", { name: new RegExp(titel) })).toHaveCount(0);
  });

  test("eine Aufgabe aussortieren, mit Rückgängig-Fenster (T-17)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");
    if (!admin) throw new Error("Seed fehlgeschlagen – TEST_MIGRATION_DATABASE_URL?");

    const [session] = await admin<{ id: string }[]>`
      insert into tutor_session (student_id, subject_id, title, entry_point)
      values (${MIA}, ${FRANZOESISCH}, ${PREFIX + " Aussortieren"}, 'hausaufgabe')
      returning id`;
    // Zwei Zeilen: eine echte Aufgabe und ein Merkkasten, den Vision
    // mitgelesen hat – genau der Fall, für den das Aussortieren da ist.
    await admin`
      insert into homework_task (student_id, session_id, position, label, prompt) values
        (${MIA}, ${session!.id}, 1, '1', ${PREFIX + " Loese 3x + 5 = 20"}),
        (${MIA}, ${session!.id}, 2, 'Merke', ${PREFIX + " Ein Bruch wird gekuerzt, indem man teilt"})`;

    await alsMia(page);
    await page.goto(`/tutor/hausaufgabe/${session!.id}`);

    // Der frühere „Überspringen"-Knopf ist weg: Er stand neben jeder Aufgabe
    // und lud zum Ausweichen ein, sobald es schwierig wurde.
    await expect(page.getByRole("button", { name: "Überspringen" })).toHaveCount(0);

    const merke = page.locator("li", { hasText: "Ein Bruch wird" });
    await expect(merke).toContainText("offen");

    // Wie beim Löschen liegt der Knopf hinter der Zeile – siehe die
    // Begründung für `dispatchEvent` im T-15-Test oben.
    await merke.locator("button", { hasText: "Gehört nicht dazu" }).dispatchEvent("click");
    await expect(merke).toContainText("gehört nicht dazu");
    await expect(page.getByText(/aussortiert/)).toBeVisible();

    // Rückgängig holt sie zurück – in der Datenbank stand nie etwas.
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect(merke).toContainText("offen");
    await page.waitForTimeout(5200);
    await page.reload();
    await expect(page.locator("li", { hasText: "Ein Bruch wird" })).toContainText("offen");

    // Und ohne Rückgängig bleibt es dabei.
    await page
      .locator("li", { hasText: "Ein Bruch wird" })
      .locator("button", { hasText: "Gehört nicht dazu" })
      .dispatchEvent("click");
    await page.waitForTimeout(5200);
    await page.reload();
    await expect(page.locator("li", { hasText: "Ein Bruch wird" })).toContainText(
      "gehört nicht dazu",
    );
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

    // Der Weg zurück (primitives.tsx: jede Unterseite trägt einen `back`) –
    // „Tutor“, weil das Label die Zielseite so benennt, wie sie oben heißt
    // (T-18). Bis T-19c hieß er „Gespräche“, und seitdem gibt es eine Seite,
    // die wirklich so heißt.
    await page.getByRole("main").getByRole("link", { name: "Tutor", exact: true }).click();
    await expect(page).toHaveURL(/\/tutor$/);
    // Zurück auf der Übersicht: das Eingabefeld für ein neues Gespräch
    // (ADR 0013 D1) – kein „Gespräch beginnen“-Knopf mehr.
    await expect(page.getByRole("textbox")).toBeVisible();
  });

  test("Nur der Verlauf scrollt – Kopfzeile und Eingabefeld stehen fest", async ({
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

    // **Gescrollt wird der Verlauf, nicht `main`** (T-12a): Kopfzeile und
    // Eingabefeld liegen als feste Zonen daneben, nicht als `sticky` darin.
    // Auf dem iPhone rutschte das klebende Eingabefeld sonst beim Scrollen
    // mit nach oben.
    const verlauf = () => page.locator("main div.overflow-y-auto").first();

    const scrollbar = await page.evaluate(() => {
      const v = document.querySelector("main div.overflow-y-auto");
      const m = document.querySelector("main");
      return {
        verlaufScrollt: v ? v.scrollHeight > v.clientHeight + 40 : false,
        mainScrolltNicht: m ? m.scrollHeight <= m.clientHeight + 1 : false,
      };
    });
    expect(scrollbar).toEqual({ verlaufScrollt: true, mainScrolltNicht: true });

    // T-10: Das Gespräch geht **am Ende** auf, nicht am Anfang – dort, wo
    // man weiterliest.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const v = document.querySelector("main div.overflow-y-auto");
          return v ? v.scrollHeight - v.scrollTop - v.clientHeight : 0;
        }),
      )
      .toBeLessThanOrEqual(64);

    // Mitten in die Antwort scrollen: Zurück-Weg und Fach-Chip bleiben oben.
    await verlauf().evaluate((el) => el.scrollTo({ top: 300 }));
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
    await verlauf().evaluate((el) => el.scrollTo({ top: 0 }));
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
    // ADR 0013 D1: kein Formular mehr davor – das Eingabefeld steht direkt
    // auf der Übersicht.
    await page.goto("/tutor");

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
    // ADR 0013 D1: kein Formular mehr davor – das Eingabefeld steht direkt
    // auf der Übersicht.
    await page.goto("/tutor");

    const feld = page.getByRole("textbox");
    await expect(feld).toBeVisible();

    // Gemessen wird seit T-16 das **Feld selbst**: Es ist jetzt der
    // Scrollcontainer (vorher die Hülle darum – ein Feld ohne eigenen
    // Scrollbereich hält beim Tippen den Cursor nicht im Bild und lässt sich
    // mit dem Finger nicht schieben).
    const feldMasse = () =>
      page.evaluate(() => {
        const f = document.querySelector("textarea");
        if (!f) return null;
        return {
          hoehe: f.clientHeight,
          scrollt: f.scrollHeight > f.clientHeight + 1,
          amEnde: f.scrollHeight - f.scrollTop - f.clientHeight <= 1,
        };
      });

    const leer = await feldMasse();
    expect(leer?.scrollt).toBe(false);

    // **Drei Zeilen müssen ganz hineinpassen** (T-12): Der Deckel liegt
    // genau dort, und ein Pixel zu wenig erzeugte eine Bildlaufleiste für
    // nichts – beim Bauen einmal passiert, deshalb hier festgehalten.
    await feld.fill("Zeile 1\nZeile 2\nZeile 3");
    await expect
      .poll(async () => (await feldMasse())?.hoehe ?? 0)
      .toBeGreaterThan((leer?.hoehe ?? 0) + 20);
    await expect.poll(async () => (await feldMasse())?.scrollt ?? false).toBe(false);

    // Genau drei Zeilen, kein angeschnittener Rest (T-16): 3 × 24 px
    // Zeilenhöhe + 12 px Polster. Mit `leading-relaxed` (22,75 px) ging die
    // Rechnung nie auf, und unten stand beim Scrollen eine halbe Zeile.
    expect((await feldMasse())?.hoehe).toBe(84);

    // Ab der vierten Zeile wächst nichts mehr, es scrollt – nichts wird
    // wortlos abgeschnitten.
    await feld.fill(Array.from({ length: 20 }, (_, i) => `Zeile ${i + 1}`).join("\n"));
    await expect.poll(async () => (await feldMasse())?.hoehe ?? 0).toBeLessThanOrEqual(90);
    await expect.poll(async () => (await feldMasse())?.scrollt ?? false).toBe(true);

    // … und das Feld steht am Ende, zeigt also die zuletzt geschriebene
    // Zeile (T-16): Beim Diktieren wuchs der Text sonst unsichtbar nach
    // unten weiter, während oben die erste Zeile stehenblieb.
    await expect.poll(async () => (await feldMasse())?.amEnde ?? false).toBe(true);
  });

  test("das Plus-Menü bietet Kamera und Mediathek, der Pegel steht im Feld (T-12)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    // ADR 0013 D1: kein Formular mehr davor – das Eingabefeld steht direkt
    // auf der Übersicht.
    await page.goto("/tutor");

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
    // es nicht mehr (S-03e).
    const pegel = page.getByRole("img", { name: /genutzt/ });
    await expect(pegel).toBeVisible();
    await expect(pegel).toHaveAttribute("aria-label", /^(Heute|Diese Woche): \d+ % genutzt$/);
  });
});

/**
 * „Zuletzt" auf `/tutor`, das Archiv unter `/tutor/gespraeche` (T-19c,
 * ADR 0014 D3).
 *
 * Eigener Block mit eigenem Präfix: Dieser Test braucht **mehr** Gespräche,
 * als die Startseite zeigt – und genau das würde den Lösch-Test oben stören,
 * der auf die erste Zeile der Liste zielt.
 */
test.describe("Gesprächs-Archiv als Kind", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  const ARCHIV = `${PREFIX}arc`;
  /** Eins mehr als die sechs, die `/tutor` zeigt – sonst gibt es nichts zu archivieren. */
  const ANZAHL = 8;
  let admin: postgres.Sql | undefined;

  test.beforeAll(async () => {
    admin = adminClient();
    if (!admin) return;
    for (let i = 0; i < ANZAHL; i++) {
      // Das letzte Gespräch trägt ein Wort, das in keinem anderen vorkommt –
      // daran prüft die Suche, dass sie wirklich filtert.
      const titel = i === ANZAHL - 1 ? `${ARCHIV} Photosynthese` : `${ARCHIV} Gespraech ${i}`;
      await admin`
        insert into tutor_session (student_id, subject_id, title, entry_point)
        values (${MIA}, ${FRANZOESISCH}, ${titel}, 'freie_frage')`;
    }
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin`delete from tutor_session where title like ${ARCHIV + "%"}`;
    await admin.end();
  });

  test("die Startseite zeigt „Zuletzt“, das Archiv den Rest – mit Suche", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "WebKit: Dev-Server bricht nach dem Rollenwechsel ab.");

    await alsMia(page);
    await page.goto("/tutor");

    // Sechs Zeilen, nicht mehr: Das Eingabefeld ist das Hauptelement der
    // Seite (ADR 0013 D1) und soll nicht nach unten rutschen. Gezählt wird
    // über `href` statt über die Titel – welche sechs es sind, hängt davon
    // ab, was parallel laufende Specs gerade anlegen; dass es genau sechs
    // sind, hängt davon nicht ab.
    await expect(gespraechsZeilen(page)).toHaveCount(6);
    await expect(page.getByText("Zuletzt")).toBeVisible();

    // Der Weg ins Archiv erscheint nur, weil dort mehr steht als hier.
    const alle = page.getByRole("link", { name: /Alle Gespräche/ });
    await expect(alle).toBeVisible();
    await alle.click();

    await expect(page).toHaveURL(/\/tutor\/gespraeche$/);
    await expect(page.getByRole("heading", { name: "Alle Gespräche", level: 1 })).toBeVisible();
    // Jetzt stehen alle da, nach Fach gruppiert (ADR 0013 D6 gilt hier weiter).
    await expect(page.getByRole("link", { name: new RegExp(ARCHIV) })).toHaveCount(ANZAHL);
    await expect(page.getByText("Französisch", { exact: true }).first()).toBeVisible();

    // Die Suche filtert im Browser, über Titel und Fach.
    const suche = page.getByPlaceholder("Suchen – Titel oder Fach");
    await suche.fill("photosynthese");
    await expect(page.getByRole("link", { name: new RegExp(ARCHIV) })).toHaveCount(1);

    // Ohne Rücksicht auf Akzente – „franzosisch" findet „Französisch".
    await suche.fill("franzosisch");
    await expect(page.getByRole("link", { name: new RegExp(ARCHIV) })).toHaveCount(ANZAHL);

    await suche.fill("gibtesnicht");
    await expect(page.getByText(/Nichts gefunden/)).toBeVisible();
  });
});
