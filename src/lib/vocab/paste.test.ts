import { describe, expect, it } from "vitest";

import { parsePastedVocabulary } from "./paste";

describe("parsePastedVocabulary", () => {
  it("erkennt Tab-getrennte Zeilen (Excel/Sheets-Copy)", () => {
    const rows = parsePastedVocabulary("aller\tgehen\nvenir\tkommen");
    expect(rows).toEqual([
      { term: "aller", translation: "gehen", unsicher: false },
      { term: "venir", translation: "kommen", unsicher: false },
    ]);
  });

  it("erkennt Semikolon-getrennte Zeilen (CSV)", () => {
    const rows = parsePastedVocabulary("aller;gehen");
    expect(rows).toEqual([{ term: "aller", translation: "gehen", unsicher: false }]);
  });

  it("erkennt Gedankenstrich- und Bindestrich-getrennte Zeilen (getippte Listen)", () => {
    expect(parsePastedVocabulary("aller – gehen")).toEqual([
      { term: "aller", translation: "gehen", unsicher: false },
    ]);
    expect(parsePastedVocabulary("aller - gehen")).toEqual([
      { term: "aller", translation: "gehen", unsicher: false },
    ]);
  });

  it("erkennt Komma-getrennte Zeilen", () => {
    const rows = parsePastedVocabulary("aller, gehen");
    expect(rows).toEqual([{ term: "aller", translation: "gehen", unsicher: false }]);
  });

  it("markiert eine Zeile ohne erkennbares Trennzeichen als unsicher", () => {
    const rows = parsePastedVocabulary("nur ein Wort ohne Trennung");
    expect(rows).toEqual([{ term: "nur ein Wort ohne Trennung", translation: "", unsicher: true }]);
  });

  it("markiert eine Zeile mit drei Teilen als unsicher, statt zu raten", () => {
    const rows = parsePastedVocabulary("aller, gehen, gehen (Verb)");
    expect(rows[0]!.unsicher).toBe(true);
  });

  it("ignoriert leere Zeilen", () => {
    const rows = parsePastedVocabulary("aller\tgehen\n\n\nvenir\tkommen\n");
    expect(rows).toHaveLength(2);
  });

  it("trimmt Leerraum und Wagenrücklauf (\\r\\n)", () => {
    const rows = parsePastedVocabulary("aller\t gehen \r\n  venir\tkommen  ");
    expect(rows).toEqual([
      { term: "aller", translation: "gehen", unsicher: false },
      { term: "venir", translation: "kommen", unsicher: false },
    ]);
  });

  it("jede Zeile wird unabhängig geprüft, eine krumme Zeile reißt andere nicht mit", () => {
    const rows = parsePastedVocabulary("aller\tgehen\nkeine Trennung hier\nvenir\tkommen");
    expect(rows.map((r) => r.unsicher)).toEqual([false, true, false]);
  });
});
