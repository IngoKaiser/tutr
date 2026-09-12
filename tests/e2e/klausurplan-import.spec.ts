import { expect, test } from "@playwright/test";

/**
 * Bild-Import Klausurplan (K-03, §6 M7, ADR 0016) – Einstieg und
 * Galerie-Mechanik.
 *
 * Der Vision-Aufruf selbst läuft hier **nicht**: In CI fehlt der
 * `ANTHROPIC_API_KEY` absichtlich (wie beim Foto-Import der Vokabeln, V-03b),
 * und ein echtes Bild durch die API zu schicken wäre ein Test der Erkennung,
 * nicht der Anwendung. Geprüft wird, dass der Weg von „Prüfungen" aus
 * erreichbar ist, beide Eingaben anbietet (Kamera/Mediathek) und die
 * Nicht-Speicher-Zusage zeigt – dieselbe Testtiefe wie beim Vokabel-Import.
 * Erkennung, Gruppenfilter, Re-Import-Matching und Übernehmen sind von Hand
 * gegen die echte API geprüft.
 */

test.describe("Klausurplan-Import", () => {
  test("Einstieg von den Prüfungen aus, Foto-Galerie sammelt vor dem Einlesen", async ({
    page,
  }) => {
    await page.goto("/heute");
    await page.getByLabel("Kind").selectOption({ label: "Mia" });
    const kindButton = page.getByRole("button", { name: "Kind" });
    await kindButton.click();
    await expect(kindButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/pruefungen");
    await page.getByRole("link", { name: "Klausurplan einlesen" }).click();
    await expect(page.getByRole("heading", { name: "Klausurplan einlesen" })).toBeVisible();
    // Der Rückweg ist schon durch `shell.spec.ts` abgedeckt („jede Unterseite
    // trägt einen Rückweg", T-18) – hier reicht die Überschrift als Beleg,
    // dass die richtige Seite geladen hat.

    await expect(page.getByText(/Fotos werden nicht gespeichert/)).toBeVisible();
    const dateifelder = page.locator('input[type="file"]');
    await expect(dateifelder).toHaveCount(2);
    await expect(page.locator('input[type="file"][capture]')).toHaveCount(1);

    // Erst sammeln, dann einlesen (wie bei der Hausaufgabe/den Vokabeln,
    // V-10): Die Auswahl allein startet keinen Server-Aufruf, sondern legt
    // eine Kachel an, die sich noch drehen und wieder wegnehmen lässt.
    await page.locator('input[type="file"]:not([capture])').setInputFiles({
      name: "plan.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByText("plan.png")).toBeVisible();
    await expect(page.getByText("Wartet")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Einlesen/ })).toBeVisible();

    await page.getByRole("button", { name: "Foto entfernen" }).click();
    await expect(page.getByText("plan.png")).toHaveCount(0);
  });
});
