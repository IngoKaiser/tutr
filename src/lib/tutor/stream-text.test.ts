import { describe, expect, it } from "vitest";

import { istEingeholt, naechsteLaenge } from "./stream-text";

describe("naechsteLaenge", () => {
  it("holt auf, ohne je über das Ziel hinauszuschießen", () => {
    expect(naechsteLaenge(0, 10, false)).toBeLessThanOrEqual(10);
    expect(naechsteLaenge(9, 10, false)).toBe(10);
  });

  it("bleibt stehen, wenn nichts Neues da ist", () => {
    expect(naechsteLaenge(120, 120, false)).toBe(120);
  });

  it("folgt einer Korrektur nach unten sofort – etwa bei einer neuen Antwort", () => {
    expect(naechsteLaenge(500, 0, false)).toBe(0);
    expect(naechsteLaenge(500, 12, true)).toBe(12);
  });

  it("bewegt sich auch bei winzigem Rückstand um mindestens zwei Zeichen", () => {
    expect(naechsteLaenge(0, 3, false)).toBeGreaterThanOrEqual(2);
  });

  it("zieht den Rest nach dem Streamende schneller nach", () => {
    const laufend = naechsteLaenge(0, 1000, false);
    const amEnde = naechsteLaenge(0, 1000, true);
    expect(amEnde).toBeGreaterThan(laufend);
  });

  it("holt einen realistischen Rückstand in unter einer Sekunde ein (60 Bilder)", () => {
    // 600 Zeichen Rückstand, wie ihn ein Schub des Modells erzeugt.
    let sichtbar = 0;
    let bilder = 0;
    while (sichtbar < 600 && bilder < 60) {
      sichtbar = naechsteLaenge(sichtbar, 600, false);
      bilder++;
    }
    expect(sichtbar).toBe(600);
    expect(bilder).toBeLessThan(60);
  });

  it("kommt immer ans Ziel, auch wenn das Ziel weiterwächst", () => {
    let sichtbar = 0;
    let ziel = 0;
    // 40 Bilder lang wächst das Ziel um 20 Zeichen je Bild …
    for (let i = 0; i < 40; i++) {
      ziel += 20;
      sichtbar = naechsteLaenge(sichtbar, ziel, false);
    }
    // … danach kommt nichts mehr nach, und der Rest läuft aus.
    for (let i = 0; i < 60 && sichtbar < ziel; i++) {
      sichtbar = naechsteLaenge(sichtbar, ziel, true);
    }
    expect(sichtbar).toBe(ziel);
  });
});

describe("istEingeholt", () => {
  it("meldet Gleichstand", () => {
    expect(istEingeholt(10, 10)).toBe(true);
    expect(istEingeholt(9, 10)).toBe(false);
  });
});
