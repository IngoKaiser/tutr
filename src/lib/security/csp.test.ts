import { describe, expect, it } from "vitest";

import { baueCsp, neuesNonce } from "./csp";

const PROD = { supabaseUrl: "https://beispiel.supabase.co", dev: false };

/** Eine Direktive aus der fertigen Kopfzeile herausholen. */
function regel(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((r) => r === name || r.startsWith(`${name} `))
    ?.slice(name.length)
    .trim();
}

describe("baueCsp", () => {
  it("bindet Skripte an das nonce – nicht an „unsafe-inline“", () => {
    const csp = baueCsp("abc123", PROD);
    expect(regel(csp, "script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("erlaubt „eval“ nur beim Entwickeln", () => {
    // React baut dort Fehler-Stacks damit nach. In Produktion braucht das
    // weder React noch Next – und dort wäre es ein offenes Scheunentor.
    expect(baueCsp("abc", { ...PROD, dev: true })).toContain("'unsafe-eval'");
    expect(baueCsp("abc", PROD)).not.toContain("'unsafe-eval'");
  });

  it("lässt Inline-Styles zu – KaTeX und die Balken setzen style-Attribute", () => {
    // Bewusst so: Ein nonce gilt für <style>-Elemente, nicht für
    // style-Attribute. Ohne diese Zeile stünde jede Formel falsch da.
    expect(regel(baueCsp("abc", PROD), "style-src")).toBe("'self' 'unsafe-inline'");
  });

  it("kennt für Verbindungen nur uns selbst und Supabase", () => {
    // Anthropic steht ausdrücklich nicht darin: Der Modellaufruf läuft auf
    // dem Server (ADR 0010 D1), der Browser spricht nie direkt mit ihm.
    expect(regel(baueCsp("abc", PROD), "connect-src")).toBe("'self' https://beispiel.supabase.co");
    expect(baueCsp("abc", PROD)).not.toContain("anthropic");
  });

  it("kommt ohne Supabase-Adresse aus, statt eine leere einzusetzen", () => {
    // CI-Build und lokaler Lauf ohne `.env`: `connect-src 'self' ` mit einem
    // leeren Eintrag wäre eine kaputte Kopfzeile, keine strengere.
    expect(regel(baueCsp("abc", { supabaseUrl: null, dev: false }), "connect-src")).toBe("'self'");
  });

  it("sperrt Einbettung, Plugins und fremde Formularziele", () => {
    const csp = baueCsp("abc", PROD);
    expect(regel(csp, "frame-ancestors")).toBe("'none'");
    expect(regel(csp, "object-src")).toBe("'none'");
    expect(regel(csp, "form-action")).toBe("'self'");
    expect(regel(csp, "base-uri")).toBe("'self'");
    expect(regel(csp, "default-src")).toBe("'self'");
  });

  it("erlaubt Bilder aus blob: und data: – Foto-Vorschau und verkleinerte Bilder", () => {
    expect(regel(baueCsp("abc", PROD), "img-src")).toBe("'self' blob: data:");
  });

  it("wertet keine Anfrage auf https auf", () => {
    // `upgrade-insecure-requests` bringt neben HSTS nichts (ein Origin, alle
    // Unteranfragen relativ) und bricht auf `http://localhost` alles: WebKit
    // nimmt localhost nicht aus und holt sich beim Entwicklungsserver einen
    // TLS-Fehler – die Seite stünde ohne JavaScript da.
    expect(baueCsp("abc", PROD)).not.toContain("upgrade-insecure-requests");
  });

  it("ergibt eine Kopfzeile ohne Zeilenumbrüche", () => {
    // Ein Umbruch in einem HTTP-Header ist nicht bloß hässlich, sondern
    // ungültig – und je nach Server ein Einfallstor.
    expect(baueCsp("abc", PROD)).not.toMatch(/[\r\n]/);
  });
});

describe("neuesNonce", () => {
  it("liefert bei jedem Aufruf einen anderen Wert", () => {
    // Ein vorhersagbares nonce hebt die ganze Kopfzeile auf.
    const werte = new Set(Array.from({ length: 50 }, () => neuesNonce()));
    expect(werte.size).toBe(50);
  });

  it("enthält nichts, was die Kopfzeile zerbricht", () => {
    expect(neuesNonce()).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
