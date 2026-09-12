import { expect, test } from "@playwright/test";

/**
 * Kindliste und Geräteliste (F-06b), bewusst schmal.
 *
 * Läuft über den Dev-Actor-Bypass, aber mit einer echten `login`-Kindliste
 * (`e2eLogin()` in `dev-actor.ts` spiegelt `npm run db:seed`: Mia und Ben,
 * ein gemeinsames Elternkonto) – ohne die wäre der Kind-Umschalter hier
 * nicht zu prüfen. Der eigentliche Beitritt (E-Mail → Kandidatensuche →
 * automatische Verknüpfung) ist in `identity.test.ts` und einem manuellen
 * Skriptlauf gegen die echte Datenbank geprüft; Playwright hat dafür noch
 * keinen Weg zu einem echten Supabase-Login (F-10).
 */

test("Einstellungen ist über das Kontomenü erreichbar (F-15)", async ({ page }) => {
  await page.goto("/heute");
  await page.getByRole("button", { name: "Kontomenü öffnen" }).click();
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
});

test("das Kontomenü zeigt E-Mail-Adresse und Abmelden, geschlossen sieht man beides nicht", async ({
  page,
}) => {
  await page.goto("/heute");
  await expect(page.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);

  await page.getByRole("button", { name: "Kontomenü öffnen" }).click();
  await expect(page.getByRole("link", { name: "Einstellungen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
});

test("zeigt beide verknüpften Kinder", async ({ page }) => {
  await page.goto("/einstellungen");
  await expect(page.getByText(/Ben, Mia|Mia, Ben/)).toBeVisible();
});

test("der Kind-Umschalter bietet beide Kinder an, weil es mehr als eines gibt", async ({
  page,
}) => {
  await page.goto("/heute");
  const switcher = page.getByLabel("Kind");
  await expect(switcher).toBeVisible();
  await expect(switcher.locator("option")).toHaveCount(2);
});

test("das Wechseln des Kindes wirkt tatsächlich – Einstellungen zeigt die neue Auswahl", async ({
  page,
}) => {
  // Ohne Cookie fällt selectedStudentId() auf das erste Kind zurück – das ist
  // Ben (alphabetisch vor Mia), nicht das Kind, das man intuitiv erwartet.
  // Deshalb erst bewusst auf Mia stellen, statt eine Startauswahl anzunehmen.
  await page.goto("/einstellungen");
  await page.getByLabel("Kind").selectOption({ label: "Mia" });
  await expect(page.getByText("von Mia")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Kind").selectOption({ label: "Ben" });
  await expect(page.getByText("von Ben")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("von Mia")).toHaveCount(0);
});

test("Geräteliste zeigt einen leeren Zustand ohne Passkeys", async ({ page }) => {
  await page.goto("/einstellungen");
  // Seed legt keine Passkeys/Sessions an (die entstehen erst durch F-06).
  await expect(page.getByText("Noch kein Passkey eingerichtet.")).toBeVisible();
  await expect(page.getByText("Keine aktive Sitzung.")).toBeVisible();
});

// --- F-06c: Profil bearbeiten ------------------------------------------
//
// Braucht die echte Datenbank (loadOwnProfile()/updateOwnProfile() lesen und
// schreiben `student`) – anders als die Tests oben, die nur die statische
// `e2eLogin()`-Kindliste brauchen. Derselbe Umweg über den Kind-Umschalter
// und den Ansichts-Umschalter wie in `heute.spec.ts`: erst Mia wählen, dann
// in die Kind-Ansicht, am Ende beides zurückstellen.

const WITH_DB = process.env.RUN_DB_TESTS === "1";

test.describe("Profil und Schuljahr (F-06c, F-16b)", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  test("ein Kind ändert seine Klasse selbst, unverändert bleibt sie nach dem Neuladen (F-06c)", async ({
    page,
  }) => {
    // Beide Umschalter hängen an einer Server Action hinter `useTransition`
    // (siehe `practice.spec.ts`/`heute.spec.ts`) – ohne die Zusicherungen
    // könnte die anschließende Navigation vor dem Setzen des Cookies
    // passieren und liefe auf Ben statt Mia bzw. auf der Elternsicht weiter.
    await page.goto("/heute");
    const kindSelect = page.getByLabel("Kind");
    const miaId = await kindSelect.locator("option", { hasText: "Mia" }).getAttribute("value");
    await kindSelect.selectOption({ label: "Mia" });
    await expect(kindSelect).toHaveValue(miaId!);

    const kindAnsicht = page
      .getByRole("group", { name: "Ansicht wechseln" })
      .getByRole("button", { name: "Kind" });
    await kindAnsicht.click();
    await expect(kindAnsicht).toHaveAttribute("aria-pressed", "true");

    await page.goto("/einstellungen");
    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
    await page.getByRole("button", { name: "Bearbeiten" }).click();

    const klasse = page.getByLabel("Klasse (optional)");
    await klasse.fill("e2e-8x");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("e2e-8x")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByText("e2e-8x")).toBeVisible();

    // Aufräumen: zurück auf Mias Seed-Klasse ("8c", `db/seed.ts`), damit
    // andere Specs den ursprünglichen Stand vorfinden.
    await page.getByRole("button", { name: "Bearbeiten" }).click();
    await klasse.fill("8c");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("8c")).toBeVisible();
    await expect(page.getByText("e2e-8x")).toHaveCount(0);

    await page.goto("/heute");
    await page
      .getByRole("group", { name: "Ansicht wechseln" })
      .getByRole("button", { name: "Eltern" })
      .click();
    await expect(page.getByLabel("Kind")).toBeVisible({ timeout: 10_000 });
  });

  // Bewusst **kein** Klick auf „… eröffnen": Das würde Mias einziges aktives
  // Schuljahr archivieren – die geteilte Seed-Zeile, an der fast jeder andere
  // Test hängt. Geprüft wird das tatsächliche Archivieren/Anlegen isoliert in
  // `curriculum.test.ts` (eigene Fixtures); hier nur, dass das Formular mit
  // einem sinnvollen Vorschlag öffnet und sich abbrechen lässt.
  test("„Neues Schuljahr eröffnen“ zeigt einen Vorschlag mit Jahrgang +1 und lässt sich abbrechen", async ({
    page,
  }) => {
    await page.goto("/heute");
    const kindSelect = page.getByLabel("Kind");
    const miaId = await kindSelect.locator("option", { hasText: "Mia" }).getAttribute("value");
    await kindSelect.selectOption({ label: "Mia" });
    await expect(kindSelect).toHaveValue(miaId!);

    await page.goto("/einstellungen");

    await page.getByRole("button", { name: "Neues Schuljahr eröffnen" }).click();
    // Mia steht im Seed auf Jahrgang 8 (siehe db-seed.mts) – der Vorschlag ist 9.
    await expect(page.getByLabel("Jahrgang")).toHaveValue("9");
    await expect(page.getByRole("button", { name: /eröffnen$/ })).toBeVisible();

    await page.getByRole("button", { name: "Abbrechen" }).click();
    await expect(page.getByRole("button", { name: "Neues Schuljahr eröffnen" })).toBeVisible();
  });
});
