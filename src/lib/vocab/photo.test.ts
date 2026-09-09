import {
  APIConnectionError,
  APIConnectionTimeoutError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { vocabExtractionSchema } from "@/ai/schemas/vocab-extraction";

import { classifyPhotoImportError, extractedRowsToPastedRows } from "./photo";

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

describe("classifyPhotoImportError", () => {
  // Echte SDK-Fehlerklassen, nicht nachgebaute Objekte – sonst prüft der
  // Test nur, dass die eigene Annahme über die Fehlerform zu sich selbst
  // passt, nicht, dass sie zur echten API passt.

  it("erkennt eine Zeitüberschreitung als vorübergehend", () => {
    const { fehler, ursache } = classifyPhotoImportError(new APIConnectionTimeoutError());
    expect(fehler).toMatch(/zu lange gebraucht/);
    expect(ursache).toBe("Zeitüberschreitung");
  });

  it("erkennt einen Verbindungsabbruch als vorübergehend", () => {
    const { fehler } = classifyPhotoImportError(
      new APIConnectionError({ message: "fetch failed" }),
    );
    expect(fehler).toMatch(/Verbindung.*abgebrochen/);
  });

  it("erkennt ein Rate Limit und nennt den Status in der Ursache", () => {
    const { fehler, ursache } = classifyPhotoImportError(
      new RateLimitError(429, { message: "rate limited" }, "429", new Headers()),
    );
    expect(fehler).toMatch(/überlastet/);
    expect(ursache).toBe("Rate Limit (429)");
  });

  it("behandelt einen 5xx-Fehler als vorübergehend, nicht als Bild-Problem", () => {
    const { fehler } = classifyPhotoImportError(
      new InternalServerError(503, { message: "overloaded" }, "503", new Headers()),
    );
    expect(fehler).toMatch(/nicht erreichbar/);
  });

  it("behandelt einen 4xx-Fehler wie den generischen Fehlschlag", () => {
    const { fehler } = classifyPhotoImportError(
      new BadRequestError(400, { message: "bad image" }, "400", new Headers()),
    );
    expect(fehler).toBe(
      "Die Bilderkennung hat nicht geklappt. Versuch es noch einmal oder tippe die Zeilen.",
    );
  });

  it("fängt einen unerwarteten Fehler auf, statt zu werfen", () => {
    const { fehler, ursache } = classifyPhotoImportError(new Error("irgendwas Unvorhergesehenes"));
    expect(fehler).toBe(
      "Die Bilderkennung hat nicht geklappt. Versuch es noch einmal oder tippe die Zeilen.",
    );
    expect(ursache).toBe("Error: irgendwas Unvorhergesehenes");
  });

  it("kommt auch mit etwas zurecht, das gar kein Error ist", () => {
    const { ursache } = classifyPhotoImportError("kaputt");
    expect(ursache).toBe("kaputt");
  });
});
