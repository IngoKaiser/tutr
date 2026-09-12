import { describe, expect, it } from "vitest";

import { textbookSuggestionSchema } from "./textbook-suggestion";

describe("textbookSuggestionSchema", () => {
  it("lässt einen gefundenen Vorschlag mit Quellen und Kapiteln durch", () => {
    const result = textbookSuggestionSchema.safeParse({
      gefunden: true,
      titel: "Découvertes 4",
      verlag: "Klett",
      jahrgangsstufe: 8,
      kapitel: [{ titel: "Unité 3", seiten: "48–67", sequence: 3 }],
      quellen: ["https://www.klett.de/lehrwerk/decouvertes"],
      hinweis: null,
    });
    expect(result.success).toBe(true);
  });

  it("lässt ein nicht gefundenes Ergebnis mit leeren Feldern durch – kein Raten erzwungen", () => {
    const result = textbookSuggestionSchema.safeParse({
      gefunden: false,
      titel: null,
      verlag: null,
      jahrgangsstufe: null,
      kapitel: [],
      quellen: [],
      hinweis: "Keine eindeutige Ausgabe gefunden.",
    });
    expect(result.success).toBe(true);
  });

  it("verlangt weiterhin das Feld „gefunden“", () => {
    const result = textbookSuggestionSchema.safeParse({
      titel: null,
      verlag: null,
      jahrgangsstufe: null,
      kapitel: [],
      quellen: [],
      hinweis: null,
    });
    expect(result.success).toBe(false);
  });
});
