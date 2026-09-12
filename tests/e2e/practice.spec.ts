import { expect, test, type Page } from "@playwright/test";

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

  test("zeigt echte Zahlen je Fach, ohne Platzhalter und ohne Umschalter (V-04)", async ({
    page,
  }) => {
    await page.goto("/ueben");
    // Ein Block je Fach (V-06, ADR 0008 D3), nicht eine Zahl über alles –
    // die Seed-Daten haben fällige Vokabeln nur in Französisch.
    await expect(page.getByRole("heading", { name: "Französisch" })).toBeVisible();
    // V-06a: gezählt wird die Vokabel, nicht die Karte. Der Seed hat zwölf
    // Vokabeln mit je zwei Karten – die Kachel zeigt 12, nicht 24.
    await expect(page.getByText("12 fällig")).toBeVisible();
    // V-04: Prüfungsmodus/Schwachstellen sind keine eigenen Kacheln mehr –
    // Schwachstellen fließen unsichtbar in die Session ein, Prüfungsmodus
    // bleibt hinter K-01 zurückgestellt.
    await expect(page.getByText("Kommt mit V-04.")).toHaveCount(0);
    // V-04: Auch die beiden Umschalter sind weg – „Loslegen" trifft keine
    // Vorentscheidung mehr. Sie stehen jetzt im Set-Modus auf der Set-Seite.
    await expect(page.getByRole("radiogroup", { name: "Richtung" })).toHaveCount(0);
    await expect(page.getByRole("radiogroup", { name: "Antwortart" })).toHaveCount(0);

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

  test("Set-Modus: beide Umschalter stehen auf der Set-Seite, Antwortart wirkt (V-04, V-06a, V-08)", async ({
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

    // Der Einstieg lebt auf der Set-Seite (V-04) – über die echte Navigation,
    // nicht per direktem `goto`.
    await page.goto("/faecher/vokabeln");
    await page.getByRole("link", { name: /Unité 3/ }).click();
    await expect(page).toHaveURL(/\/faecher\/vokabeln\/.+/);

    // Richtung beschriftet sich weiterhin aus der Fachsprache (V-06a) –
    // Französisch (`language: 'fr'` im Seed) → „FR → DE" / „DE → FR". Ein
    // Frage-Antwort-Fach ohne Sprache hätte hier gar keinen Umschalter.
    const richtung = page.getByRole("radiogroup", { name: "Richtung" });
    await expect(richtung.getByRole("radio", { name: "Gemischt" })).toBeVisible();
    await expect(richtung.getByRole("radio", { name: "FR → DE" })).toBeVisible();
    await expect(richtung.getByRole("radio", { name: "DE → FR" })).toBeVisible();

    // Alle Seed-Karten sind 'neu' → ohne Umschalter käme Multiple Choice
    // (modeForCardState()). „Tippen" erzwingt das Eingabefeld trotzdem (V-08).
    await page
      .getByRole("radiogroup", { name: "Antwortart" })
      .getByRole("radio", { name: "Tippen" })
      .click();
    await page.getByRole("link", { name: "Dieses Set üben" }).click();

    await expect(page).toHaveURL(/\/ueben\?set=.*art=tippen/);
    await expect(page.locator("input[autocomplete='off']")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("button.text-left")).toHaveCount(0);
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

  test("offline beantwortet landet in der Warteschlange, sichtbares Signal, Sync bei Rückkehr (F-09b/F-09c)", async ({
    page,
    context,
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
    const options = page.locator("button.text-left");
    await expect(options.first()).toBeVisible({ timeout: 10_000 });

    // Offline, bevor überhaupt geantwortet wird – `submitAnswer()` darf gar
    // nicht erst versucht werden (kein Warten auf einen Timeout), sondern
    // muss sofort in die Warteschlange gehen.
    await context.setOffline(true);
    await options.first().click();

    // Die Rückmeldung kommt trotzdem sofort und ist keine Notlösung –
    // dieselbe Klassifikation, die der Server nutzen würde (`previewOutcome()`).
    const weiter = page.getByRole("button", { name: "Weiter" });
    await expect(weiter).toBeVisible({ timeout: 10_000 });

    // In der Warteschlange gelandet, nicht stillschweigend verloren – und
    // sichtbar als ruhiges Signal, nicht nur intern in IndexedDB (F-09c).
    expect(await countPendingAnswers(page)).toBe(1);
    await expect(page.getByText("Wird synchronisiert, sobald wieder Netz da ist.")).toBeVisible();
    await expect(page.getByText("1 Antwort wartet auf Synchronisierung.")).toBeVisible();

    await weiter.click();
    await context.setOffline(false);

    // Der `online`-Listener liefert nach – abwarten, bis die Warteschlange
    // leer ist, statt eine feste Zeit zu raten. Das Signal verschwindet mit ihr.
    await expect.poll(() => countPendingAnswers(page), { timeout: 10_000 }).toBe(0);
    await expect(page.getByText(/Antwort(en)? wartet? auf Synchronisierung/)).toHaveCount(0);
  });

  test("ein Elternteil sieht die Zahlen, aber keinen Startknopf", async ({ page }) => {
    // Ohne Kind-Rollenwechsel bleibt der Actor Elternteil (Standard des Bypasses).
    await page.goto("/ueben");
    await expect(page.getByText(/\d+ fällig/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Loslegen" })).toHaveCount(0);
    await expect(page.getByText(/hier siehst du nur den Stand/)).toBeVisible();
  });
});

/**
 * Zählt die Einträge in der Offline-Warteschlange direkt in IndexedDB
 * (F-09b) – Name und Objektspeicher wie in `src/lib/vocab/answer-queue.ts`.
 * Dieselbe `onupgradeneeded`-Fallback-Erstellung wie dort: Läuft der Test,
 * bevor die App die Datenbank selbst angelegt hat, entsteht sie hier leer
 * statt den Test mit einer fehlenden Datenbank scheitern zu lassen.
 */
async function countPendingAnswers(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("tutr-offline", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("pending-answers", { keyPath: "id" });
        };
        request.onsuccess = () => {
          const db = request.result;
          const zaehler = db
            .transaction("pending-answers", "readonly")
            .objectStore("pending-answers")
            .count();
          zaehler.onsuccess = () => {
            db.close();
            resolve(zaehler.result);
          };
          zaehler.onerror = () => reject(zaehler.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}
