import { expect, test } from "@playwright/test";

/**
 * Die vollständige Passkey-Zeremonie über einen virtuellen Authenticator.
 *
 * Das ist der einzige Test, der belegt, was Unit- und Policy-Tests nicht
 * können: dass ein *Browser* unsere Optionen annimmt – vor allem
 * `residentKey: "required"` – und dass die Wiederanmeldung ohne jede Kennung
 * auskommt. Genau daran hängt ADR 0005.
 *
 * Zwei Einschränkungen, beide bewusst:
 *
 * 1. **Nur Chromium.** Virtuelle Authenticators gibt es über das
 *    DevTools-Protokoll; WebKit kennt nichts Vergleichbares. Das
 *    mobile Projekt läuft auf WebKit und überspringt diese Datei.
 * 2. **Nur mit Datenbank** (`RUN_DB_TESTS=1`). Der Lauf legt eine echte
 *    Familie an. In CI fehlen dafür die Zugangsdaten – dieselbe Lücke, die
 *    F-10 schließt.
 */

const WITH_DB = process.env.RUN_DB_TESTS === "1";

test.describe("Passkey-Zeremonie", () => {
  test.skip(!WITH_DB, "Braucht eine Datenbank – mit RUN_DB_TESTS=1 ausführen.");

  test("anlegen und danach ohne Kennung wiederkommen", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Virtuelle Authenticators nur über CDP.");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        // Der Kern: ein auffindbarer Passkey. Ohne `hasResidentKey` lehnt der
        // Authenticator unsere Registrierungsoptionen ab – und genau das soll
        // dieser Test merken.
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    const firstName = `Testkind${Date.now().toString().slice(-6)}`;

    await page.goto("/registrieren");
    await page.getByLabel("Vorname").fill(firstName);
    await page.getByLabel("Jahrgang").selectOption("8");
    await page.getByLabel("E-Mail deiner Eltern").fill("eltern@example.org");
    await page.getByRole("button", { name: "Profil anlegen" }).click();

    await expect(page).toHaveURL(/\/heute$/, { timeout: 20_000 });

    const afterRegistration = await sessionCookie(page);
    expect(afterRegistration).toBeTruthy();

    // Session wegwerfen, Passkey behalten – der Fall „lange nicht benutzt".
    // Der Cookie-Name folgt SESSION_COOKIE aus student-session.ts.
    await page.context().clearCookies({ name: "tutr_student" });
    await page.goto("/anmelden");

    await page.getByRole("button", { name: /Face ID/i }).click();
    await expect(page).toHaveURL(/\/heute$/, { timeout: 20_000 });

    const afterReturn = await sessionCookie(page);
    expect(afterReturn).toBeTruthy();
    expect(afterReturn).not.toBe(afterRegistration);
  });
});

async function sessionCookie(page: import("@playwright/test").Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "tutr_student")?.value;
}
