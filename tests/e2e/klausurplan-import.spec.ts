import { expect, test } from "@playwright/test";

/**
 * Bild-Import Klausurplan (K-03, §6 M7, ADR 0016) – Einstieg (Kanalwahl,
 * K-04) und Galerie-Mechanik.
 *
 * Der Vision-Aufruf selbst läuft hier **nicht**: In CI fehlt der
 * `ANTHROPIC_API_KEY` absichtlich (wie beim Foto-Import der Vokabeln, V-03b),
 * und ein echtes Bild durch die API zu schicken wäre ein Test der Erkennung,
 * nicht der Anwendung. Erkennung, Gruppenfilter, Re-Import-Matching und
 * Übernehmen sind von Hand gegen die echte API geprüft.
 *
 * **Anders als bei den Vokabeln nicht DB-gated**, sondern zur Laufzeit: Ohne
 * Schlüssel zeigt die Seite ehrlich „nicht eingerichtet" (`page.tsx`,
 * `anthropicConfigured()`) – genau das ist hier der geprüfte Fall in CI. Mit
 * Schlüssel (lokal, `.env.test.local`) prüft derselbe Lauf zusätzlich die
 * Galerie-Mechanik.
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

    // Ohne Datenbank (`DATABASE_URL` fehlt, wie im normalen E2E-Job ohne
    // DB-Secret) zeigt die Seite schon vor der Kanalwahl "nicht
    // eingerichtet" – dann gibt es gar keine Foto/Datei-Knöpfe zu finden.
    const dbNichtEingerichtet = await page
      .getByText(/nicht eingerichtet/)
      .isVisible()
      .catch(() => false);
    test.skip(
      dbNichtEingerichtet,
      "Die Datenbank ist in dieser Umgebung nicht gesetzt (wie in CI).",
    );

    // Kanalwahl (K-04): erst Foto/Datei, danach wie gehabt.
    await page.getByRole("button", { name: "Foto" }).click();

    const nichtEingerichtet = await page
      .getByText(/nicht eingerichtet/)
      .isVisible()
      .catch(() => false);
    test.skip(
      nichtEingerichtet,
      "ANTHROPIC_API_KEY ist in dieser Umgebung nicht gesetzt (wie in CI).",
    );

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
