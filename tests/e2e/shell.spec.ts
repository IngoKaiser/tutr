import { expect, test } from "@playwright/test";

/**
 * App-Shell (F-07): die fünf Bereiche aus Konzept §5, Navigation, Manifest.
 * Prüft die Struktur, nicht die Beispieldaten – die ersetzen K-01/V-01.
 */

const SECTIONS = [
  { path: "/heute", label: "Heute" },
  { path: "/faecher", label: "Fächer" },
  { path: "/ueben", label: "Üben" },
  { path: "/pruefungen", label: "Prüfungen" },
  { path: "/tutor", label: "Tutor" },
] as const;

for (const section of SECTIONS) {
  test(`${section.label} ist erreichbar und in der Navigation markiert`, async ({ page }) => {
    await page.goto(section.path);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(section.label);

    const activeLink = page.getByRole("navigation", { name: "Bereiche" }).getByRole("link", {
      name: section.label,
    });
    await expect(activeLink).toHaveAttribute("aria-current", "page");
  });
}

test("Navigation führt zwischen den Bereichen", async ({ page }) => {
  await page.goto("/heute");
  const navi = page.getByRole("navigation", { name: "Bereiche" });

  await navi.getByRole("link", { name: "Üben" }).click();
  await expect(page).toHaveURL(/\/ueben$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Üben");

  await navi.getByRole("link", { name: "Tutor" }).click();
  await expect(page).toHaveURL(/\/tutor$/);
});

test("Alle fünf Bereiche stehen jederzeit zur Wahl", async ({ page }) => {
  await page.goto("/heute");
  const links = page.getByRole("navigation", { name: "Bereiche" }).getByRole("link");
  await expect(links).toHaveCount(5);
});

/**
 * Die Regel aus `primitives.tsx`: **Jede Seite unterhalb eines
 * Fußleisten-Bereichs trägt einen Rückweg** – und er benennt die Zielseite so,
 * wie sie oben heißt. Dreimal vergessen worden (zuletzt bei den Einstellungen,
 * T-18), deshalb steht sie jetzt auch als Test da.
 *
 * Hier nur die Seiten, die ohne Testdaten erreichbar sind; die tieferen
 * (Vokabelset, Gespräch, Aufgabe) prüfen ihre eigenen Specs.
 */
const UNTERSEITEN = [
  { path: "/faecher/vokabeln", titel: "Vokabeln", zurueck: "Fächer" },
  // Kein Fußleisten-Bereich, hängt im Kopfbereich – und stand deshalb lange
  // ganz ohne Ausgang da (T-18).
  { path: "/einstellungen", titel: "Einstellungen", zurueck: "Heute" },
] as const;

for (const seite of UNTERSEITEN) {
  test(`${seite.titel} führt zurück zu „${seite.zurueck}“`, async ({ page }) => {
    await page.goto(seite.path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(seite.titel);

    const zurueck = page.getByRole("main").getByRole("link", { name: seite.zurueck });
    await expect(zurueck).toBeVisible();
    await zurueck.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(seite.zurueck);
  });
}

test("Manifest ist gültig und startet auf Heute", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);

  const manifest = (await res.json()) as {
    name: string;
    start_url: string;
    display: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe("tutr");
  expect(manifest.start_url).toBe("/heute");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i) => i.sizes)).toContain("512x512");
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
});

test("Manifest-Icons werden ausgeliefert", async ({ request }) => {
  for (const pfad of ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"]) {
    const res = await request.get(pfad);
    expect(res.ok(), pfad).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

test("Anmeldeseite ist ohne Session erreichbar", async ({ page }) => {
  await page.goto("/anmelden");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anmelden");
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmeldelink schicken" })).toBeVisible();
  // Der Einladungslink, auf den dieser Test einmal prüfte, ist mit ADR 0005
  // entfallen: Das Kind meldet sich selbst an. Was stattdessen auf der Seite
  // stehen muss, prüft `anmeldung.spec.ts`.
});

test("Anmeldung weist eine unvollständige Adresse zurück", async ({ page }) => {
  await page.goto("/anmelden");
  await page.getByLabel("E-Mail-Adresse").fill("keine-adresse");
  await page.getByRole("button", { name: "Anmeldelink schicken" }).click();

  // Browser-Validierung greift vor dem Absenden – das Formular bleibt stehen.
  await expect(page.getByRole("button", { name: "Anmeldelink schicken" })).toBeVisible();
});

test("Ein abgelaufener Anmeldelink erklärt sich, statt wortlos zurückzuwerfen", async ({
  page,
}) => {
  // Genau die URL, die Supabase erzeugt: Der Grund steht im Hash-Fragment und
  // erreicht den Server nie – die Seite muss ihn clientseitig auslesen.
  await page.goto("/anmelden?fehler=kein-code#error=access_denied&error_code=otp_expired");

  // Nexts Routen-Ansage trägt ebenfalls role="alert" – auf den Text eingrenzen.
  const notice = page.getByRole("alert").filter({ hasText: "Link" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/nicht mehr gültig/);
  await expect(notice).toContainText(/vorab öffnet/);

  // Der Fehler verschwindet aus der Adresszeile, damit Neuladen ihn nicht wiederholt.
  await expect(page).toHaveURL(/\/anmelden$/);
});

test("Die Bestätigungsseite löst den Token beim Laden nicht ein", async ({ page }) => {
  const link = "/anmelden/bestaetigen?token_hash=beispiel-token&type=magiclink";

  // Zweimal laden – ein Vorab-Öffner im Mailprogramm täte genau das. Danach
  // muss der Knopf immer noch da sein: Nichts wurde verbraucht.
  await page.goto(link);
  await expect(page.getByRole("button", { name: "Anmeldung abschließen" })).toBeVisible();

  await page.goto(link);
  await expect(page.getByRole("button", { name: "Anmeldung abschließen" })).toBeVisible();
  await expect(page).toHaveURL(/bestaetigen/);
});

test("Ein unvollständiger Bestätigungslink erklärt sich", async ({ page }) => {
  await page.goto("/anmelden/bestaetigen");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("unvollständig");
  await expect(page.getByRole("link", { name: "Zur Anmeldung" })).toBeVisible();
});
