import { describe, expect, it } from "vitest";

import { AI_LIMITS, pruefeLimit } from "./rate-limit";

describe("pruefeLimit", () => {
  it("lässt durch, solange beide Fenster Luft haben", () => {
    expect(pruefeLimit({ letzteStunde: 0, letzterTag: 0 })).toEqual({ erlaubt: true });
    expect(
      pruefeLimit({ letzteStunde: AI_LIMITS.stunde - 1, letzterTag: AI_LIMITS.tag - 1 }),
    ).toEqual({ erlaubt: true });
  });

  it("blockt am Stundenlimit mit einem Hinweis auf die nächste Stunde", () => {
    const e = pruefeLimit({ letzteStunde: AI_LIMITS.stunde, letzterTag: 25 });
    expect(e.erlaubt).toBe(false);
    if (!e.erlaubt) expect(e.nachricht).toMatch(/Stunde/);
  });

  it("blockt am Tageslimit mit einem Hinweis auf morgen", () => {
    const e = pruefeLimit({ letzteStunde: 5, letzterTag: AI_LIMITS.tag });
    expect(e.erlaubt).toBe(false);
    if (!e.erlaubt) expect(e.nachricht).toMatch(/morgen/);
  });

  it("das Tageslimit hat Vorrang, wenn beide erreicht sind", () => {
    const e = pruefeLimit({ letzteStunde: AI_LIMITS.stunde, letzterTag: AI_LIMITS.tag });
    expect(e.erlaubt).toBe(false);
    if (!e.erlaubt) expect(e.nachricht).toMatch(/morgen/);
  });

  it("keine Nachricht klingt nach Strafe – kein „Limit“, kein „Fehler“", () => {
    const stunde = pruefeLimit({ letzteStunde: AI_LIMITS.stunde, letzterTag: 0 });
    const tag = pruefeLimit({ letzteStunde: 0, letzterTag: AI_LIMITS.tag });
    for (const e of [stunde, tag]) {
      expect(e.erlaubt).toBe(false);
      if (!e.erlaubt) {
        expect(e.nachricht.toLowerCase()).not.toMatch(/limit|fehler|error|blockiert/);
      }
    }
  });
});
