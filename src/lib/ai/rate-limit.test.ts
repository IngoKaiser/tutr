import { describe, expect, it } from "vitest";

import {
  AI_LIMITS,
  auslastungAusKosten,
  anzeigeFenster,
  kombiniereAuslastung,
  kostenUsd,
  pruefeLimit,
} from "./rate-limit";

describe("kostenUsd", () => {
  it("bewertet Ausgabe-Tokens fünfmal so teuer wie Eingabe-Tokens (Sonnet 5)", () => {
    const eingabe = kostenUsd(1_000_000, 0);
    const ausgabe = kostenUsd(0, 1_000_000);
    expect(ausgabe).toBeCloseTo(eingabe * 5, 10);
  });

  it("1 Mio. Eingabe-Tokens kosten 2 $, 1 Mio. Ausgabe-Tokens 10 $", () => {
    expect(kostenUsd(1_000_000, 0)).toBeCloseTo(2, 10);
    expect(kostenUsd(0, 1_000_000)).toBeCloseTo(10, 10);
  });

  it("0 Tokens kosten 0 $", () => {
    expect(kostenUsd(0, 0)).toBe(0);
  });

  it("eine Websuche kostet 0,01 $, zusätzlich zu den Tokens (L-01)", () => {
    expect(kostenUsd(0, 0, 1)).toBeCloseTo(0.01, 10);
    expect(kostenUsd(0, 0, 3)).toBeCloseTo(0.03, 10);
    expect(kostenUsd(1_000_000, 0, 1)).toBeCloseTo(2.01, 10);
  });

  it("ohne dritten Parameter bleibt die Websuche 0 $ – bestehende Aufrufe ohne Websuche-Tool", () => {
    expect(kostenUsd(1_000_000, 1_000_000)).toBeCloseTo(kostenUsd(1_000_000, 1_000_000, 0), 10);
  });
});

describe("pruefeLimit", () => {
  const NICHTS = { stundeUsd: 0, tagUsd: 0, wocheUsd: 0 };

  it("lässt durch, solange alle drei Fenster Luft haben", () => {
    expect(pruefeLimit(NICHTS)).toEqual({ erlaubt: true });
    expect(
      pruefeLimit({
        stundeUsd: AI_LIMITS.stundeUsd - 0.01,
        tagUsd: AI_LIMITS.tagUsd - 0.01,
        wocheUsd: AI_LIMITS.wocheUsd - 0.01,
      }),
    ).toEqual({ erlaubt: true });
  });

  it("blockt am Stundendeckel mit einem Hinweis auf die nächste Stunde", () => {
    const e = pruefeLimit({ ...NICHTS, stundeUsd: AI_LIMITS.stundeUsd });
    expect(e.erlaubt).toBe(false);
    if (!e.erlaubt) expect(e.nachricht).toMatch(/Stunde/);
  });

  it("blockt am Tagesdeckel mit einem Hinweis auf morgen", () => {
    const e = pruefeLimit({ ...NICHTS, tagUsd: AI_LIMITS.tagUsd });
    expect(e.erlaubt).toBe(false);
    if (!e.erlaubt) expect(e.nachricht).toMatch(/morgen/);
  });

  it("blockt am Wochendeckel mit einem Hinweis auf nächste Woche", () => {
    const e = pruefeLimit({ ...NICHTS, wocheUsd: AI_LIMITS.wocheUsd });
    expect(e.erlaubt).toBe(false);
    if (!e.erlaubt) expect(e.nachricht).toMatch(/Woche/);
  });

  it("der Wochendeckel hat Vorrang, wenn mehrere Fenster erreicht sind – sonst wäre die Zusage falsch", () => {
    const alle = pruefeLimit({
      stundeUsd: AI_LIMITS.stundeUsd,
      tagUsd: AI_LIMITS.tagUsd,
      wocheUsd: AI_LIMITS.wocheUsd,
    });
    expect(alle.erlaubt).toBe(false);
    if (!alle.erlaubt) expect(alle.nachricht).toMatch(/Woche/);

    const tagUndStunde = pruefeLimit({
      stundeUsd: AI_LIMITS.stundeUsd,
      tagUsd: AI_LIMITS.tagUsd,
      wocheUsd: 0,
    });
    expect(tagUndStunde.erlaubt).toBe(false);
    if (!tagUndStunde.erlaubt) expect(tagUndStunde.nachricht).toMatch(/morgen/);
  });

  it("keine Nachricht klingt nach Strafe – kein „Limit“, kein „Fehler“", () => {
    const varianten = [
      pruefeLimit({ ...NICHTS, stundeUsd: AI_LIMITS.stundeUsd }),
      pruefeLimit({ ...NICHTS, tagUsd: AI_LIMITS.tagUsd }),
      pruefeLimit({ ...NICHTS, wocheUsd: AI_LIMITS.wocheUsd }),
    ];
    for (const e of varianten) {
      expect(e.erlaubt).toBe(false);
      if (!e.erlaubt) {
        expect(e.nachricht.toLowerCase()).not.toMatch(/limit|fehler|error|blockiert/);
      }
    }
  });
});

describe("auslastungAusKosten", () => {
  it("0 $ sind 0 Auslastung in jedem Fenster", () => {
    expect(auslastungAusKosten({ stundeUsd: 0, tagUsd: 0, wocheUsd: 0 })).toEqual({
      stunde: 0,
      tag: 0,
      woche: 0,
    });
  });

  it("die Hälfte des Stundendeckels ist eine Auslastung von 0,5", () => {
    expect(
      auslastungAusKosten({ stundeUsd: AI_LIMITS.stundeUsd / 2, tagUsd: 0, wocheUsd: 0 }).stunde,
    ).toBeCloseTo(0.5, 10);
  });

  it("deckelt bei 1, auch wenn die Kosten über dem Limit liegen", () => {
    const auslastung = auslastungAusKosten({
      stundeUsd: AI_LIMITS.stundeUsd * 3,
      tagUsd: AI_LIMITS.tagUsd * 2,
      wocheUsd: AI_LIMITS.wocheUsd * 1.1,
    });
    expect(auslastung).toEqual({ stunde: 1, tag: 1, woche: 1 });
  });

  it("rechnet jedes Fenster gegen seinen eigenen Deckel, nicht gegeneinander", () => {
    const auslastung = auslastungAusKosten({
      stundeUsd: AI_LIMITS.stundeUsd,
      tagUsd: 0,
      wocheUsd: 0,
    });
    expect(auslastung.stunde).toBe(1);
    expect(auslastung.tag).toBe(0);
    expect(auslastung.woche).toBe(0);
  });
});

describe("kombiniereAuslastung", () => {
  it("nimmt je Fenster den höheren der beiden Werte – der Kanal, der zuerst voll ist, pausiert zuerst", () => {
    const tutor = { stunde: 0.2, tag: 0.9, woche: 0.1 };
    const vision = { stunde: 0.8, tag: 0.3, woche: 0.1 };
    expect(kombiniereAuslastung(tutor, vision)).toEqual({ stunde: 0.8, tag: 0.9, woche: 0.1 });
  });

  it("ist symmetrisch – die Reihenfolge der Kanäle spielt keine Rolle", () => {
    const a = { stunde: 0.4, tag: 0.6, woche: 0.9 };
    const b = { stunde: 0.7, tag: 0.2, woche: 0.5 };
    expect(kombiniereAuslastung(a, b)).toEqual(kombiniereAuslastung(b, a));
  });
});

describe("anzeigeFenster – nur Heute und Diese Woche (S-03e)", () => {
  it("findet das straffere der beiden sichtbaren Fenster", () => {
    expect(anzeigeFenster({ stunde: 0.1, tag: 0.8, woche: 0.3 })).toEqual({
      fenster: "tag",
      anteil: 0.8,
    });
    expect(anzeigeFenster({ stunde: 0.1, tag: 0.2, woche: 0.6 })).toEqual({
      fenster: "woche",
      anteil: 0.6,
    });
  });

  it("die Stunde bleibt außen vor, auch wenn sie am vollsten ist", () => {
    // Der Stundendeckel schützt weiter (`pruefeLimit`), aber er ist kein
    // Zeitraum, in dem jemand plant – die Anzeige kennt ihn nicht.
    const gewaehlt = anzeigeFenster({ stunde: 0.99, tag: 0.2, woche: 0.1 });
    expect(gewaehlt.fenster).toBe("tag");
    expect(gewaehlt.anteil).toBe(0.2);
  });

  it("bei Gleichstand gewinnt der Tag – er füllt sich schneller wieder auf", () => {
    expect(anzeigeFenster({ stunde: 0, tag: 0.5, woche: 0.5 }).fenster).toBe("tag");
    expect(anzeigeFenster({ stunde: 0, tag: 0, woche: 0 })).toEqual({ fenster: "tag", anteil: 0 });
  });
});
