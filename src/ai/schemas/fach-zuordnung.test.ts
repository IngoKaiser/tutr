import { describe, expect, it } from "vitest";

import { fachZuordnungSchema } from "./fach-zuordnung";

/** Was das Modell neben dem Fach liefert (T-19a) – hier nie der Prüfgegenstand. */
const TITEL = { titel: "Lineare Gleichungen" };

describe("fachZuordnungSchema", () => {
  it("lässt jeden übergebenen Fachnamen und „unklar“ durch", () => {
    const schema = fachZuordnungSchema(["Mathematik", "Französisch"]);
    expect(schema.safeParse({ fach: "Mathematik", ...TITEL }).success).toBe(true);
    expect(schema.safeParse({ fach: "Französisch", ...TITEL }).success).toBe(true);
    expect(schema.safeParse({ fach: "unklar", ...TITEL }).success).toBe(true);
  });

  it("lehnt einen Namen ab, der nicht in der Liste stand – die Auswahl ist geschlossen (ADR 0013 D2)", () => {
    const schema = fachZuordnungSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Chemie", ...TITEL }).success).toBe(false);
    expect(schema.safeParse({ fach: "mathematik", ...TITEL }).success).toBe(false);
  });

  it("funktioniert auch mit einer leeren Fächerliste – dann bleibt nur „unklar“", () => {
    const schema = fachZuordnungSchema([]);
    expect(schema.safeParse({ fach: "unklar", ...TITEL }).success).toBe(true);
    expect(schema.safeParse({ fach: "irgendwas", ...TITEL }).success).toBe(false);
  });

  it("nimmt einen leeren Titel an – er heißt „kein Thema“, nicht „Fehler“ (ADR 0014 D2)", () => {
    // Ein Schema-Fehler risse den ganzen Aufruf mit und damit die
    // Fach-Zuordnung, die daneben steht. Der Rückfall auf die gekürzte Frage
    // passiert in `bereinigeTitel()`, nicht hier.
    const schema = fachZuordnungSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Mathematik", titel: "" }).success).toBe(true);
  });

  it("deckelt einen Titel, der zum Satz wird", () => {
    const schema = fachZuordnungSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Mathematik", titel: "x".repeat(81) }).success).toBe(false);
  });

  it("verlangt den Titel – ein fehlendes Feld ist etwas anderes als ein leeres", () => {
    const schema = fachZuordnungSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Mathematik" }).success).toBe(false);
  });
});
