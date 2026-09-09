import { describe, expect, it } from "vitest";

import { vocabExtractionSchema } from "@/ai/schemas/vocab-extraction";

import { extractedRowsToPastedRows } from "./photo";

describe("extractedRowsToPastedRows", () => {
  it("macht aus niedriger Konfidenz eine unsichere Zeile", () => {
    expect(
      extractedRowsToPastedRows([
        { term: "se lever", translation: "aufstehen", confidence: "hoch" },
        { term: "s'habiller", translation: "sich anziehen", confidence: "niedrig" },
      ]),
    ).toEqual([
      { term: "se lever", translation: "aufstehen", unsicher: false },
      { term: "s'habiller", translation: "sich anziehen", unsicher: true },
    ]);
  });

  it("behält eine Zeile ohne Übersetzung – genau die soll man ergänzen", () => {
    expect(
      extractedRowsToPastedRows([{ term: "ensuite", translation: "", confidence: "niedrig" }]),
    ).toEqual([{ term: "ensuite", translation: "", unsicher: true }]);
  });

  it("verwirft eine Zeile ohne Wort, die trüge nichts zum Ergänzen", () => {
    expect(
      extractedRowsToPastedRows([
        { term: "   ", translation: "danach", confidence: "niedrig" },
        { term: "", translation: "", confidence: "hoch" },
      ]),
    ).toEqual([]);
  });

  it("schneidet Leerraum ab, den die Erkennung mitliefert", () => {
    expect(
      extractedRowsToPastedRows([
        { term: "  la fenêtre ", translation: " das Fenster  ", confidence: "hoch" },
      ]),
    ).toEqual([{ term: "la fenêtre", translation: "das Fenster", unsicher: false }]);
  });
});

describe("vocabExtractionSchema", () => {
  it("nimmt eine wohlgeformte Modellantwort an", () => {
    const parsed = vocabExtractionSchema.parse({
      rows: [{ term: "venir", translation: "kommen", confidence: "hoch" }],
    });
    expect(parsed.rows).toHaveLength(1);
  });

  it("weist eine erfundene Konfidenzstufe zurück, statt sie durchzulassen", () => {
    // Der Grund für zwei feste Stufen statt einer Zahl: Was das Modell hier
    // ausgibt, entscheidet in der Liste über „prüfen" oder nicht.
    expect(() =>
      vocabExtractionSchema.parse({
        rows: [{ term: "venir", translation: "kommen", confidence: "vielleicht" }],
      }),
    ).toThrow();
  });

  it("weist eine Zeile ohne Übersetzungsfeld zurück – leer ja, fehlend nein", () => {
    expect(() =>
      vocabExtractionSchema.parse({ rows: [{ term: "venir", confidence: "hoch" }] }),
    ).toThrow();
  });
});
