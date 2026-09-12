import { describe, expect, it } from "vitest";

import { textbookExtractionSchema } from "./textbook-extraction";

const KAPITEL = { titel: "3 Unité 3 · Une journée particulière", seiten: "48–67", sequence: 3 };

describe("textbookExtractionSchema", () => {
  it("lässt ein vollständiges Ergebnis durch", () => {
    const result = textbookExtractionSchema.safeParse({
      titel: "Découvertes 4",
      verlag: "Klett",
      jahrgangsstufe: 8,
      kapitel: [KAPITEL],
    });
    expect(result.success).toBe(true);
  });

  it("lässt Titel, Verlag und Jahrgangsstufe leer (nicht auf dem Foto zu sehen)", () => {
    const result = textbookExtractionSchema.safeParse({
      titel: null,
      verlag: null,
      jahrgangsstufe: null,
      kapitel: [KAPITEL],
    });
    expect(result.success).toBe(true);
  });

  it("lässt eine leere Kapitelliste durch – ein Foto ohne lesbares Inhaltsverzeichnis ist kein Schemafehler", () => {
    const result = textbookExtractionSchema.safeParse({
      titel: null,
      verlag: null,
      jahrgangsstufe: null,
      kapitel: [],
    });
    expect(result.success).toBe(true);
  });

  it("verlangt bei einem Kapitel Titel und Reihenfolge", () => {
    const result = textbookExtractionSchema.safeParse({
      titel: null,
      verlag: null,
      jahrgangsstufe: null,
      kapitel: [{ titel: "Unité 3", seiten: null }],
    });
    expect(result.success).toBe(false);
  });
});
