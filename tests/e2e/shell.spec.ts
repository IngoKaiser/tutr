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
