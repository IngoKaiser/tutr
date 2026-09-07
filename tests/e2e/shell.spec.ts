import { expect, test } from "@playwright/test";

/**
 * App-Shell (F-07): die fünf Bereiche aus Konzept §5, Navigation, Manifest.
 * Prüft die Struktur, nicht die Beispieldaten – die ersetzen K-01/V-01.
 */

const BEREICHE = [
  { pfad: "/heute", label: "Heute" },
  { pfad: "/faecher", label: "Fächer" },
  { pfad: "/ueben", label: "Üben" },
  { pfad: "/pruefungen", label: "Prüfungen" },
  { pfad: "/tutor", label: "Tutor" },
] as const;

for (const bereich of BEREICHE) {
  test(`${bereich.label} ist erreichbar und in der Navigation markiert`, async ({ page }) => {
    await page.goto(bereich.pfad);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(bereich.label);

    const aktiv = page.getByRole("navigation", { name: "Bereiche" }).getByRole("link", {
      name: bereich.label,
    });
    await expect(aktiv).toHaveAttribute("aria-current", "page");
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

test("Anmeldeseite ist ohne Session erreichbar und erklärt den Weg fürs Kind", async ({ page }) => {
  await page.goto("/anmelden");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anmelden");
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmeldelink schicken" })).toBeVisible();
  // Konzept §11: Das Kind meldet sich nie per E-Mail an – das muss auf der
  // Seite stehen, sonst versucht ein Elternteil es für sie.
  await expect(page.getByText(/Einladungslink/)).toBeVisible();
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
  const hinweis = page.getByRole("alert").filter({ hasText: "Link" });
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText(/nicht mehr gültig/);
  await expect(hinweis).toContainText(/vorab öffnet/);

  // Der Fehler verschwindet aus der Adresszeile, damit Neuladen ihn nicht wiederholt.
  await expect(page).toHaveURL(/\/anmelden$/);
});
