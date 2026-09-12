import { expect, test } from "@playwright/test";

/**
 * App-Shell (F-07): die fünf Bereiche aus Konzept §5, Navigation, Manifest.
 * Prüft die Struktur, nicht die Beispieldaten – die ersetzen K-01/V-01.
 */

const SECTIONS = [
  { path: "/heute", label: "Heute" },
  { path: "/faecher", label: "Fächer" },
  { path: "/ueben", label: "Üben" },
  { path: "/pruefungen", label: "Prüfungen" },
  { path: "/tutor", label: "Tutor" },
] as const;

for (const section of SECTIONS) {
  test(`${section.label} ist erreichbar und in der Navigation markiert`, async ({ page }) => {
    await page.goto(section.path);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(section.label);

    const activeLink = page.getByRole("navigation", { name: "Bereiche" }).getByRole("link", {
      name: section.label,
    });
    await expect(activeLink).toHaveAttribute("aria-current", "page");
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

/**
 * Die Regel aus `primitives.tsx`: **Jede Seite unterhalb eines
 * Fußleisten-Bereichs trägt einen Rückweg** – und er benennt die Zielseite so,
 * wie sie oben heißt. Dreimal vergessen worden (zuletzt bei den Einstellungen,
 * T-18), deshalb steht sie jetzt auch als Test da.
 *
 * Hier nur die Seiten, die ohne Testdaten erreichbar sind; die tieferen
 * (Vokabelset, Gespräch, Aufgabe) prüfen ihre eigenen Specs.
 */
const UNTERSEITEN = [
  { path: "/faecher/vokabeln", titel: "Vokabeln", zurueck: "Fächer" },
  // Das Archiv (T-19c): `/tutor` zeigt nur die letzten sechs Gespräche.
  { path: "/tutor/gespraeche", titel: "Alle Gespräche", zurueck: "Tutor" },
  // Kein Fußleisten-Bereich, hängt im Kopfbereich – und stand deshalb lange
  // ganz ohne Ausgang da (T-18).
  { path: "/einstellungen", titel: "Einstellungen", zurueck: "Heute" },
] as const;

for (const seite of UNTERSEITEN) {
  test(`${seite.titel} führt zurück zu „${seite.zurueck}“`, async ({ page }) => {
    await page.goto(seite.path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(seite.titel);

    const zurueck = page.getByRole("main").getByRole("link", { name: seite.zurueck });
    await expect(zurueck).toBeVisible();
    await zurueck.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(seite.zurueck);
  });
}

/**
 * Content-Security-Policy (S-03a).
 *
 * Zwei Dinge, die nur zusammen etwas aussagen: dass die Kopfzeile **da** ist
 * und richtig aussieht – und dass die App unter ihr noch läuft. Das Zweite
 * ist das eigentlich Wichtige: Eine zu strenge CSP bricht nicht laut, sie
 * lässt die Seite nur stumm ohne JavaScript stehen.
 *
 * Geprüft wird gegen `next dev`, wie der Rest dieser Suite. Der Unterschied
 * zur Produktion ist genau ein Eintrag (`'unsafe-eval'`, den React beim
 * Entwickeln für seine Fehler-Stacks braucht) – `nonce` und `strict-dynamic`,
 * auf die es hier ankommt, sind dieselben. Gegen den echten Produktionsbau
 * läuft die Suite erst mit F-10.
 */
test("Jede Seite trägt eine Content-Security-Policy mit frischem nonce", async ({ page }) => {
  const ersteAntwort = await page.goto("/heute");
  const csp = ersteAntwort?.headers()["content-security-policy"] ?? "";

  expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp).toContain("'strict-dynamic'");
  // Der ganze Zweck der Übung: Ein eingeschleustes <script> hat kein nonce.
  expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  // Der Modellaufruf läuft auf dem Server (ADR 0010 D1) – stünde Anthropic
  // hier, wäre das ein falsches Versprechen über den Bau der App.
  expect(csp).not.toContain("anthropic");

  // Jede Anfrage bekommt ein eigenes nonce – ein wiederverwendetes wäre
  // ratbar und hübe die Kopfzeile auf.
  const zweiteAntwort = await page.goto("/faecher");
  expect(zweiteAntwort?.headers()["content-security-policy"]).not.toBe(csp);
});

test("Unter der CSP läuft die App weiter – auch vor der Anmeldung", async ({ page }) => {
  const verstoesse: string[] = [];
  page.on("console", (nachricht) => {
    const text = nachricht.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) {
      verstoesse.push(text);
    }
  });

  // `/anmelden` und `/registrieren` sind der wunde Punkt: Sie kamen ohne
  // Anmeldung aus und wurden deshalb statisch vorgerendert – eine
  // vorgerenderte Seite hat kein nonce, ihre Skripte liefen unter dieser
  // Kopfzeile gar nicht mehr. Seit S-03a rendern sie dynamisch.
  for (const pfad of ["/heute", "/tutor", "/anmelden", "/registrieren"]) {
    await page.goto(pfad);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  // **Der eigentliche Beweis, dass JavaScript läuft**: ein Klick auf einen
  // `next/link` navigiert clientseitig. Bleibt die Überschrift stehen, ist
  // die Seite tot – und genau so hat sich `upgrade-insecure-requests`
  // gezeigt: WebKit nimmt `http://localhost` nicht von der https-Aufwertung
  // aus, holte sich für jedes `/_next/static/...` einen TLS-Fehler und ließ
  // die Seite ohne ein einziges Skript stehen. Zwanzig rote Tests, alle im
  // `[mobile]`-Projekt, keiner in `[desktop]` – Chrome nimmt localhost aus.
  await page.goto("/faecher/vokabeln");
  await page.getByRole("main").getByRole("link", { name: "Fächer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fächer");

  expect(verstoesse).toEqual([]);
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

test("Anmeldeseite ist ohne Session erreichbar", async ({ page }) => {
  await page.goto("/anmelden");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anmelden");
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmeldelink schicken" })).toBeVisible();
  // Der Einladungslink, auf den dieser Test einmal prüfte, ist mit ADR 0005
  // entfallen: Das Kind meldet sich selbst an. Was stattdessen auf der Seite
  // stehen muss, prüft `anmeldung.spec.ts`.
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
  const notice = page.getByRole("alert").filter({ hasText: "Link" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/nicht mehr gültig/);
  await expect(notice).toContainText(/vorab öffnet/);

  // Der Fehler verschwindet aus der Adresszeile, damit Neuladen ihn nicht wiederholt.
  await expect(page).toHaveURL(/\/anmelden$/);
});

test("Die Bestätigungsseite löst den Token beim Laden nicht ein", async ({ page }) => {
  const link = "/anmelden/bestaetigen?token_hash=beispiel-token&type=magiclink";

  // Zweimal laden – ein Vorab-Öffner im Mailprogramm täte genau das. Danach
  // muss der Knopf immer noch da sein: Nichts wurde verbraucht.
  await page.goto(link);
  await expect(page.getByRole("button", { name: "Anmeldung abschließen" })).toBeVisible();

  await page.goto(link);
  await expect(page.getByRole("button", { name: "Anmeldung abschließen" })).toBeVisible();
  await expect(page).toHaveURL(/bestaetigen/);
});

test("Ein unvollständiger Bestätigungslink erklärt sich", async ({ page }) => {
  await page.goto("/anmelden/bestaetigen");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("unvollständig");
  await expect(page.getByRole("link", { name: "Zur Anmeldung" })).toBeVisible();
});
