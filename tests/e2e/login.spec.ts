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
    const parentPath = page.getByRole("heading", { name: "Ich bin ein Elternteil" });

    await expect(passkey).toBeVisible();
    await expect(parentPath).toBeVisible();

    // Das Kind ist die tägliche Nutzerin – ihr Weg steht oben.
    const passkeyTop = (await passkey.boundingBox())?.y ?? 0;
    const parentTop = (await parentPath.boundingBox())?.y ?? 0;
    expect(passkeyTop).toBeLessThan(parentTop);
  });

  /**
   * F-14: Auf einem Browser ohne Gerätenotiz wird die WebAuthn-Zeremonie
   * nicht gestartet – der Systemdialog mit QR-Code und
   * Sicherheitsschlüssel führt ohne Profil nirgendwohin.
   *
   * Der Knopf verschwindet dabei **nicht**. Ein erster Anlauf tauschte ihn
   * schon beim Rendern gegen einen Link aus; weil `localStorage` erst nach
   * der Hydration lesbar ist, sprang die Seite sichtbar um – und der Test
   * oben fand den Knopf mal, mal nicht. Deshalb hier beides geprüft: dass
   * der Knopf steht und dass ein Druck darauf zur Selbstanlage weist.
   */
  test("schickt ohne Passkey auf diesem Gerät zur Selbstanlage statt in den Systemdialog", async ({
    page,
  }) => {
    await page.goto("/anmelden");

    await page.getByRole("button", { name: /Face ID/i }).click();

    await expect(page.getByText(/noch kein Zugang eingerichtet/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Leg dir ein Profil an" })).toBeVisible();
    await expect(page).toHaveURL(/\/anmelden$/);
  });

  test("lässt den Weg trotzdem frei, wenn die Gerätenotiz irrt", async ({ page }) => {
    await page.goto("/anmelden");
    await page.getByRole("button", { name: /Face ID/i }).click();

    // Browserdaten gelöscht, Passkey aber noch im Schlüsselbund: Die Notiz
    // darf sich irren, sie darf niemanden aussperren.
    await page.getByRole("button", { name: "Ich habe hier schon einen Passkey" }).click();

    await expect(page.getByText(/noch kein Zugang eingerichtet/i)).toHaveCount(0);
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
