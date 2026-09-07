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

test("Einstellungen ist über den Kopfbereich erreichbar", async ({ page }) => {
  await page.goto("/heute");
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
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
