import { describe, expect, it } from "vitest";

import { AI_LIMITS, kostenUsd, pruefeLimit } from "./rate-limit";

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
