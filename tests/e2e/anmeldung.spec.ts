import { expect, test } from "@playwright/test";

/**
 * Die beiden Wege in die App (F-06, ADR 0005).
 *
 * Diese Datei prüft die Oberfläche ohne Datenbank: dass beide Wege angeboten
 * werden, in der richtigen Gewichtung, und dass das Formular das verlangt,
 * was ADR 0005 verlangt. Die vollständige Zeremonie steht in
 * `passkey.spec.ts` und braucht eine Datenbank.
 */

test.describe("Anmeldeseite", () => {
  test("bietet den Passkey zuerst an, den Elternweg darunter", async ({ page }) => {
    await page.goto("/anmelden");

    const passkey = page.getByRole("button", { name: /Face ID/i });
    const elternweg = page.getByRole("heading", { name: "Ich bin ein Elternteil" });

    await expect(passkey).toBeVisible();
    await expect(elternweg).toBeVisible();

    // Das Kind ist die tägliche Nutzerin – ihr Weg steht oben.
    const obenPasskey = (await passkey.boundingBox())?.y ?? 0;
    const obenEltern = (await elternweg.boundingBox())?.y ?? 0;
    expect(obenPasskey).toBeLessThan(obenEltern);
  });

  test("führt zur Selbstanlage", async ({ page }) => {
    await page.goto("/anmelden");
    await page.getByRole("link", { name: "Profil anlegen" }).click();
    await expect(page).toHaveURL(/\/registrieren$/);
    await expect(page.getByRole("heading", { name: "Leg dein Profil an" })).toBeVisible();
  });
});

test.describe("Selbstanlage", () => {
  test("fragt drei Angaben – und nicht mehr", async ({ page }) => {
    await page.goto("/registrieren");

    await expect(page.getByLabel("Vorname")).toBeVisible();
    await expect(page.getByLabel("Jahrgang")).toBeVisible();
    await expect(page.getByLabel("E-Mail deiner Eltern")).toBeVisible();

    // Kein Geburtsdatum, keine eigene E-Mail des Kindes (Konzept §11). Und
    // keine Klasse: Die braucht erst der Gruppenfilter beim Klausurplan-Import
    // (K-03), und maßgeblich steht sie dann am Schuljahr.
    await expect(page.getByLabel(/Geburt/i)).toHaveCount(0);
    await expect(page.getByLabel(/Klasse/)).toHaveCount(0);
  });

  test("sagt vor dem Absenden, dass die Elternmail nicht blockiert", async ({ page }) => {
    await page.goto("/registrieren");
    await expect(page.getByText(/hält dich nicht auf/)).toBeVisible();
  });

  test("führt zurück zur Anmeldung", async ({ page }) => {
    await page.goto("/registrieren");
    await page.getByRole("link", { name: "Hier anmelden" }).click();
    await expect(page).toHaveURL(/\/anmelden$/);
  });
});
