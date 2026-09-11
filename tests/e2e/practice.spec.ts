import { expect, test } from "@playwright/test";

/**
 * Übungssession (V-02, §6 M4).
 *
 * Bewusst **nicht** eine ganze Session bis zum Ende durchklicken: Bei
 * zufälligem Raten unter Multiple Choice braucht das im Schnitt vier
 * Versuche je Karte, bei zwölf Vokabeln (24 Karten) reicht das für
 * dutzende Server-Aktionen gegen die echte Datenbank – langsam und
 * genau die Sorte E2E-Test, die in CI flackert, ohne mehr zu beweisen als
 * eine einzelne beantwortete Karte. Die Warteschlangen-Mechanik selbst
 * (Stapel, Terminierung, Geschwister-Abstand) ist in `session.test.ts`
 * vollständig und deterministisch geprüft, ohne Browser.
 *
 * Läuft über den Dev-Actor-Bypass mit explizit gewähltem Kind (Mia) – wie
 * `settings.spec.ts`. Nutzt die Seed-Vokabeln aus `npm run db:seed`; jeder
 * Lauf beantwortet ein paar davon *wirklich*, `npm run db:seed` setzt sie
 * bei Bedarf zurück. Nur mit Datenbank (`RUN_DB_TESTS=1`).
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

test.describe("Übungssession", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/heute");
    const kindSelect = page.getByLabel("Kind");
    const miaId = await kindSelect.locator("option", { hasText: "Mia" }).getAttribute("value");
    await kindSelect.selectOption({ label: "Mia" });
    // `setSelectedStudent()` ist eine Server Action hinter `useTransition` –
    // `selectOption()` löst sie nur aus, wartet aber nicht auf sie. Ohne
    // diese Zusicherung könnte eine anschließende Navigation vor dem Setzen
    // des Cookies passieren; die Seite zeigt dann Bens Stand (kein Vokabelset,
    // 0 fällig) statt Mias. Vorher unauffällig, weil "0 fällig" ebenfalls auf
    // /\d+ fällig/ passte – seit V-06 zeigt ein Fach ohne fällige Karten gar
    // keinen Block mehr, und der Fehlgriff wurde sichtbar.
    await expect(kindSelect).toHaveValue(miaId!);
  });

  test("zeigt echte Zahlen je Fach statt der Attrappe, und V-04-Blöcke sagen ehrlich, dass sie fehlen", async ({
    page,
  }) => {
    await page.goto("/ueben");
    // Ein Block je Fach (V-06, ADR 0008 D3), nicht eine Zahl über alles –
    // die Seed-Daten haben fällige Vokabeln nur in Französisch.
    await expect(page.getByRole("heading", { name: "Französisch" })).toBeVisible();
    // V-06a: gezählt wird die Vokabel, nicht die Karte. Der Seed hat zwölf
    // Vokabeln mit je zwei Karten – die Kachel zeigt 12, nicht 24.
    await expect(page.getByText("12 fällig")).toBeVisible();
    await expect(page.getByText("Kommt mit V-04.")).toHaveCount(2);

    // V-08: Lernstand über den ganzen Wortschatz, nicht nur die Fälligen –
    // die drei Kacheln heißen jetzt „Neu / Am Üben / Sitzt". Exakte Zahlen
    // wandern, sobald ein anderer Test eine Karte beantwortet hat; hier zählt
    // nur, dass der Fortschritt überhaupt sichtbar ist. Über den Tag-Namen
    // gesucht (nicht `getByText`): Seit V-13 nennt die aufklappbare
    // Lernrhythmus-Erklärung darunter dieselben drei Wörter noch einmal
    // (als `<b>`), `getByText` fände also zwei Treffer.
    for (const label of ["Neu", "Am Üben", "Sitzt"]) {
      await expect(page.locator("span", { hasText: label })).toBeVisible();
    }
  });

  test("die Antwortart lässt sich auf Tippen zwingen, auch wenn die Karte neu ist (V-08)", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebKit: Next-Dev-Server bricht nach dem Rollenwechsel ab.",
    );

    await page.goto("/heute");
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/ueben");
    const nichtsFaellig = await page
      .getByText("Nichts fällig. Schau später wieder vorbei.")
      .count();
    test.skip(nichtsFaellig > 0, "Keine fälligen Karten – npm run db:seed erneut ausführen.");

    // Alle Seed-Karten sind 'neu' → ohne Umschalter käme Multiple Choice
    // (modeForCardState()). „Tippen" erzwingt das Eingabefeld trotzdem.
    await page
      .getByRole("radiogroup", { name: "Antwortart" })
      .getByRole("radio", { name: "Tippen" })
      .click();
    await page.getByRole("button", { name: "Loslegen" }).click();

    await expect(page.locator("input[autocomplete='off']")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("button.text-left")).toHaveCount(0);
  });

  test("Richtungsumschalter beschriftet sich aus der Fachsprache (V-06a)", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebKit: Next-Dev-Server bricht nach dem Rollenwechsel ab.",
    );
    await page.goto("/heute");
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/ueben");
    const nichtsFaellig = await page
      .getByText("Nichts fällig. Schau später wieder vorbei.")
      .count();
    test.skip(nichtsFaellig > 0, "Keine fälligen Karten – npm run db:seed erneut ausführen.");

    // Französisch (`language: 'fr'` im Seed) → „FR → DE" / „DE → FR",
    // nicht mehr fest getippt. Ein Frage-Antwort-Fach ohne Sprache hätte
    // hier gar keinen Umschalter.
    const richtung = page.getByRole("radiogroup", { name: "Richtung" });
    await expect(richtung.getByRole("radio", { name: "Gemischt" })).toBeVisible();
    await expect(richtung.getByRole("radio", { name: "FR → DE" })).toBeVisible();
    await expect(richtung.getByRole("radio", { name: "DE → FR" })).toBeVisible();
  });

  test("eine Karte beantworten zeigt eine Rückmeldung, 'Weiter' bringt sichtbar weiter", async ({
    page,
    browserName,
  }) => {
    // Nur Chromium: Unter echtem WebKit (das "mobile"-Projekt, nicht nur ein
    // kleiner Viewport) bricht der Next-Dev-Server die Verbindung direkt
    // nach dem Rollenwechsel ab ("ECONNRESET") – von Hand nachgestellt
    // (Chromium, mobiler Viewport, identischer Ablauf) läuft derselbe Weg
    // sofort korrekt und zeigt die echten 12 fälligen Vokabeln (V-06a: je Vokabel eine Karte). Kein Fund an
    // der Anwendung, sondern dieselbe Art Engine-Lücke wie die fehlenden
    // virtuellen Authenticators in `passkey.spec.ts`.
    test.skip(
      browserName !== "chromium",
      "WebKit: Next-Dev-Server bricht nach dem Rollenwechsel ab.",
    );

    // "Loslegen" gibt es nur für die Kind-Rolle (Vokabel-Policies: Kind
    // schreibt, Eltern lesen) – ohne diesen Wechsel bliebe der Knopf
    // unsichtbar, siehe der dritte Test unten.
    await page.goto("/heute");
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    // `aria-pressed` statt `networkidle`: steht erst, wenn `loginStatus()`
    // die neue Rolle tatsächlich zurückgegeben hat.
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/ueben");
    const startButton = page.getByRole("button", { name: "Loslegen" });
    // Kein Fach mit fälligen Karten mehr zeigt gar kein "N fällig" – dann
    // steht stattdessen die "Nichts fällig"-Notiz.
    const nichtsFaellig = await page
      .getByText("Nichts fällig. Schau später wieder vorbei.")
      .count();
    test.skip(nichtsFaellig > 0, "Keine fälligen Karten – npm run db:seed erneut ausführen.");

    await startButton.click();

    // Erste Karte ist immer 'neu' → Multiple Choice (modeForCardState()).
    const options = page.locator("button.text-left");
    await expect(options.first()).toBeVisible({ timeout: 10_000 });
    const before = await options.count();
    expect(before).toBeGreaterThan(0);

    await options.first().click();

    // Rückmeldung vor der nächsten Karte – ohne sie wäre Raten nicht von
    // Wissen zu unterscheiden. "Weiter" ist der einzige Weg dorthin, kein
    // Auto-Sprung nach einer Zeit (§15: keine unsichtbare Uhr, die drängt).
    const weiter = page.getByRole("button", { name: "Weiter" });
    await expect(weiter).toBeVisible({ timeout: 10_000 });
    await weiter.click();

    // Danach entweder eine neue Frage (MC-Prompt oder Tippfeld) oder "fertig" –
    // beides beweist, dass die Antwort verarbeitet wurde, keine Blockade.
    await expect(
      page
        .locator("button.text-left")
        .first()
        .or(page.locator("input[autocomplete='off']"))
        .or(page.getByText(/Alle fälligen Karten in .+ sind einmal gesessen/)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("aus einer laufenden Übung kommt man zurück zur Übersicht", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebKit: Next-Dev-Server bricht nach dem Rollenwechsel ab.",
    );

    await page.goto("/heute");
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/ueben");
    const nichtsFaellig = await page
      .getByText("Nichts fällig. Schau später wieder vorbei.")
      .count();
    test.skip(nichtsFaellig > 0, "Keine fälligen Karten – npm run db:seed erneut ausführen.");

    await page.getByRole("button", { name: "Loslegen" }).click();
    await expect(page.locator("button.text-left").first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Zur Übersicht" }).click();
    await expect(page.getByRole("button", { name: "Loslegen" })).toBeVisible();
  });

  test("ein Elternteil sieht die Zahlen, aber keinen Startknopf", async ({ page }) => {
    // Ohne Kind-Rollenwechsel bleibt der Actor Elternteil (Standard des Bypasses).
    await page.goto("/ueben");
    await expect(page.getByText(/\d+ fällig/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Loslegen" })).toHaveCount(0);
    await expect(page.getByText(/hier siehst du nur den Stand/)).toBeVisible();
  });
});
