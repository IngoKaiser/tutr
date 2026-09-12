import { expect, test, type Page } from "@playwright/test";
import type postgres from "postgres";

import { adminClient } from "../e2e/test-db";

/**
 * Was nur der Produktions-Bau zeigt (F-10a). Siehe `playwright.prod.config.ts`
 * für das Warum – kurz: Die reguläre Suite umgeht die Anmeldung und läuft
 * gegen `next dev`, also bleiben genau die Dinge ungeprüft, die sich zwischen
 * beiden unterscheiden.
 *
 * Diese Datei prüft deshalb **nicht** noch einmal die Funktionen der App.
 * Sie prüft vier Dinge, die es nur hier gibt:
 *
 * 1. Die Tür ist zu – ohne Sitzung führt jeder Weg auf `/anmelden`.
 * 2. Der Entwicklungs-Umschalter existiert nicht.
 * 3. Die Content-Security-Policy ist die strenge Fassung, und jedes
 *    Skript-Tag trägt ihr `nonce`.
 * 4. Eine echte Anmeldung per Passkey trägt durch die ganze App.
 */

const WITH_DB = process.env.TEST_DATABASE_URL ? true : false;

test.describe("Produktions-Bau", () => {
  test.skip(
    !WITH_DB,
    "Braucht die Test-Datenbank (TEST_DATABASE_URL) – ohne sie liefe der Server gegen die Produktivdatenbank.",
  );

  let admin: postgres.Sql | undefined;
  const angelegt: string[] = [];

  test.beforeAll(() => {
    admin = adminClient();
  });

  test.afterAll(async () => {
    // Der Lauf legt ein echtes Kind mit echtem Passkey an. Liegen bleiben
    // darf es nicht (F-13) – `student` kaskadiert auf Passkey und Sitzung.
    if (admin && angelegt.length > 0) {
      await admin`delete from student where first_name in ${admin(angelegt)}`;
    }
    await admin?.end();
  });

  test("Ohne Sitzung führt jeder Weg auf die Anmeldung", async ({ page }) => {
    // Die wichtigste Zusage der App – und in der regulären Suite
    // ausgeschaltet, weil `TUTR_E2E_ACTOR` die Anmeldung überspringt.
    for (const pfad of [
      "/heute",
      "/tutor",
      "/faecher",
      "/ueben",
      "/pruefungen",
      "/einstellungen",
    ]) {
      await page.goto(pfad);
      await expect(page, `${pfad} ohne Sitzung`).toHaveURL(/\/anmelden/);
    }

    // `/` leitet auf `/heute` – und von dort weiter vor die Tür.
    await page.goto("/");
    await expect(page).toHaveURL(/\/anmelden/);
  });

  test("Der Entwicklungs-Umschalter gibt es hier nicht", async ({ page }) => {
    // `switcherAvailable()` ist in Produktion aus. Stünde er doch da, könnte
    // jeder Angemeldete in eine fremde Ansicht wechseln.
    await page.goto("/anmelden");
    await expect(page.getByLabel("Kind")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kind" })).toHaveCount(0);
  });

  test("Die Content-Security-Policy ist die strenge Fassung", async ({ page }) => {
    const antwort = await page.goto("/anmelden");
    const csp = antwort?.headers()["content-security-policy"] ?? "";

    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).toContain("'strict-dynamic'");
    // Der Unterschied zur Entwicklung: Dort braucht React `eval` für seine
    // Fehler-Stacks. Hier darf es das nicht – und nur hier lässt sich das
    // überhaupt prüfen.
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
  });

  test("Jedes Skript-Tag trägt das nonce – auch auf vorgerenderten Seiten", async ({ page }) => {
    // **Der Test, der bei S-03a gefehlt hat.** `/anmelden` und
    // `/registrieren` kamen ohne Anmeldung aus und wurden deshalb zur
    // Buildzeit vorgerendert; eine vorgerenderte Seite hat kein `nonce`, und
    // unter der neuen Kopfzeile lief dort kein einziges Skript mehr. Im
    // Entwicklungsserver war davon nichts zu sehen.
    for (const pfad of ["/anmelden", "/registrieren", "/konto-geloescht"]) {
      await page.goto(pfad);
      const skripte = await page.evaluate(() => {
        const alle = [...document.querySelectorAll("script")];
        return { gesamt: alle.length, ohneNonce: alle.filter((s) => !s.nonce).length };
      });
      expect(skripte.gesamt, `${pfad} hat überhaupt Skripte`).toBeGreaterThan(0);
      expect(skripte.ohneNonce, `${pfad} ohne nonce`).toBe(0);
    }
  });

  test("Eine echte Anmeldung per Passkey trägt durch die ganze App", async ({ page }) => {
    const verstoesse: string[] = [];
    page.on("console", (nachricht) => {
      const text = nachricht.text();
      if (!/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) return;
      // `/_vercel/insights/script.js` bedient die Plattform selbst; hier
      // antwortet niemand darauf. Das ist keine Zurückweisung durch die CSP,
      // sondern eine Datei, die es lokal nicht gibt.
      //
      // Bis hierher hat diese Zeile allerdings etwas Echtes gemeldet: Der
      // Proxy beantwortete den Pfad mit einer Weiterleitung auf `/anmelden`,
      // weil er im `matcher` fehlte – auch auf Vercel hätte damit jeder
      // Nichtangemeldete HTML statt JavaScript bekommen.
      if (text.includes("/_vercel/")) return;
      verstoesse.push(text);
    });

    await virtuellerAuthenticator(page);

    const vorname = `Prodkind${Date.now().toString().slice(-6)}`;
    angelegt.push(vorname);

    await page.goto("/registrieren");
    await page.getByLabel("Vorname").fill(vorname);
    await page.getByLabel("Jahrgang").selectOption("8");
    await page.getByLabel("E-Mail deiner Eltern").fill("eltern@example.org");
    await page.getByRole("button", { name: "Profil anlegen" }).click();

    // Angekommen – und zwar als *das Kind selbst*, nicht über einen
    // Umschalter. Genau diese Rolle prüft die reguläre Suite nie echt.
    await expect(page).toHaveURL(/\/heute$/, { timeout: 30_000 });

    // Durch alle fünf Bereiche, über die Fußleiste wie ein Mensch. Bleibt
    // eine Überschrift stehen, läuft kein JavaScript – so hätte sich das
    // `nonce`-Problem aus S-03a von selbst gemeldet.
    const navi = page.getByRole("navigation", { name: "Bereiche" });
    for (const bereich of ["Fächer", "Üben", "Prüfungen", "Tutor", "Heute"]) {
      await navi.getByRole("link", { name: bereich }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(bereich);
    }

    // Sitzung wegwerfen, Passkey behalten – der Fall „lange nicht benutzt".
    await page.context().clearCookies({ name: "tutr_student" });
    await page.goto("/heute");
    await expect(page).toHaveURL(/\/anmelden/);

    await page.getByRole("button", { name: /Face ID/i }).click();
    await expect(page).toHaveURL(/\/heute$/, { timeout: 30_000 });

    expect(verstoesse).toEqual([]);
  });
});

/**
 * Ein auffindbarer Passkey im Browser (wie `passkey.spec.ts`, ADR 0005).
 * Ohne `hasResidentKey` lehnt der Authenticator unsere Registrierungsoptionen
 * ab.
 */
async function virtuellerAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
