import { expect, test } from "@playwright/test";

/**
 * Der App-Rahmen: Kopf- und Fußleiste stehen fest, Felder lösen kein
 * Hineinzoomen aus (F-18).
 *
 * Beides sind Regeln in `globals.css`, die man einer Momentaufnahme nicht
 * ansieht – deshalb hier über die *berechneten* Werte geprüft, nicht über
 * Klassennamen.
 *
 * Braucht keine Datenbank: Der Dev-Actor-Bypass reicht bis `/heute`.
 */
test.describe("App-Rahmen", () => {
  test("auf einer App-Seite friert der Body ein – auf der Anmeldeseite nicht", async ({ page }) => {
    await page.goto("/heute");
    await expect(page.getByRole("heading", { name: "Heute", level: 1 })).toBeVisible();

    const imRahmen = await page.evaluate(() => ({
      body: getComputedStyle(document.body).overflowY,
      html: getComputedStyle(document.documentElement).overflowY,
      rahmen: document.querySelectorAll(".app-rahmen").length,
    }));
    expect(imRahmen.rahmen).toBe(1);
    expect(imRahmen.body).toBe("hidden");
    expect(imRahmen.html).toBe("hidden");

    // Die Anmeldeseite hängt direkt am Wurzel-Layout, hat keinen eigenen
    // Scrollbereich und muss deshalb weiter scrollen dürfen.
    await page.goto("/anmelden");
    const ohneRahmen = await page.evaluate(() => ({
      body: getComputedStyle(document.body).overflowY,
      rahmen: document.querySelectorAll(".app-rahmen").length,
    }));
    expect(ohneRahmen.rahmen).toBe(0);
    expect(ohneRahmen.body).not.toBe("hidden");
  });

  test("die Fußleiste bleibt beim Scrollen stehen", async ({ page }) => {
    await page.goto("/heute");
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();

    const vorher = (await nav.boundingBox())!;
    // In `main` scrollen, nicht im Fenster – genau das ist der Unterschied.
    await page.locator("main").evaluate((el) => el.scrollBy(0, 400));
    const nachher = (await nav.boundingBox())!;

    expect(Math.abs(nachher.y - vorher.y)).toBeLessThan(2);
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("Eingabefelder setzen auf Tippgeräten mindestens 16 px – sonst zoomt iOS hinein", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Die Regel gilt für `pointer: coarse` – nur im mobilen Projekt.");

    await page.goto("/anmelden");
    const feld = page.locator("input:not([type='hidden'])").first();
    await expect(feld).toBeVisible();

    const groesse = await feld.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(groesse).toBeGreaterThanOrEqual(16);
  });
});
