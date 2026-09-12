import { describe, expect, it } from "vitest";

import { sortForReview, withDerivedUnsicher, type VocabRow } from "./review-list";

describe("withDerivedUnsicher", () => {
  it("markiert eine leere Übersetzung als unsicher", () => {
    const [row] = withDerivedUnsicher([
      { id: "1", term: "aller", translation: "", recognition_uncertain: false },
    ]);
    expect(row!.unsicher).toBe(true);
  });

  it("markiert ein leeres Wort als unsicher", () => {
    const [row] = withDerivedUnsicher([
      { id: "1", term: "  ", translation: "gehen", recognition_uncertain: false },
    ]);
    expect(row!.unsicher).toBe(true);
  });

  it("markiert dasselbe Wort mit zwei Übersetzungen als unsicher – beide Zeilen", () => {
    const rows = withDerivedUnsicher([
      { id: "1", term: "voler", translation: "fliegen", recognition_uncertain: false },
      { id: "2", term: "Voler", translation: "stehlen", recognition_uncertain: false },
    ]);
    expect(rows.every((r) => r.unsicher)).toBe(true);
  });

  it("übernimmt die gespeicherte Konfidenz-Markierung", () => {
    const [row] = withDerivedUnsicher([
      { id: "1", term: "venir", translation: "kommen", recognition_uncertain: true },
    ]);
    expect(row!.unsicher).toBe(true);
  });

  it("lässt eine saubere, eindeutige Zeile in Ruhe", () => {
    const [row] = withDerivedUnsicher([
      { id: "1", term: "partir", translation: "abfahren", recognition_uncertain: false },
    ]);
    expect(row!.unsicher).toBe(false);
  });
});

describe("withDerivedUnsicher – bestätigte Zeilen (V-09)", () => {
  it("nimmt „gleiches Wort, andere Übersetzung“ die Markierung, sobald bestätigt", () => {
    // Der Anlass: `pasar` = verbringen / passieren. Beide Zeilen sind
    // richtig, ohne `confirmed_at` blieben sie für immer „prüfen“.
    const rows = withDerivedUnsicher([
      {
        id: "1",
        term: "pasar",
        translation: "verbringen",
        recognition_uncertain: false,
        confirmed_at: new Date("2026-09-11T00:00:00Z"),
      },
      {
        id: "2",
        term: "pasar",
        translation: "passieren; geschehen",
        recognition_uncertain: false,
        confirmed_at: new Date("2026-09-11T00:00:00Z"),
      },
    ]);
    expect(rows.map((r) => r.unsicher)).toEqual([false, false]);
  });

  it("bestätigt nur, was bestätigt wurde – die andere Zeile bleibt markiert", () => {
    const rows = withDerivedUnsicher([
      {
        id: "1",
        term: "pasar",
        translation: "verbringen",
        recognition_uncertain: false,
        confirmed_at: new Date("2026-09-11T00:00:00Z"),
      },
      { id: "2", term: "pasar", translation: "passieren", recognition_uncertain: false },
    ]);
    expect(rows.map((r) => r.unsicher)).toEqual([false, true]);
  });

  it("nimmt auch der gespeicherten Konfidenz-Markierung ihre Wirkung", () => {
    const [row] = withDerivedUnsicher([
      {
        id: "1",
        term: "venir",
        translation: "kommen",
        recognition_uncertain: true,
        confirmed_at: new Date("2026-09-11T00:00:00Z"),
      },
    ]);
    expect(row!.unsicher).toBe(false);
  });

  it("ein leeres Feld bleibt markiert, auch bestätigt – das ist eine Lücke, keine Einschätzung", () => {
    const [row] = withDerivedUnsicher([
      {
        id: "1",
        term: "aller",
        translation: "   ",
        recognition_uncertain: false,
        confirmed_at: new Date("2026-09-11T00:00:00Z"),
      },
    ]);
    expect(row!.unsicher).toBe(true);
  });

  it("`confirmed_at: null` verhält sich wie „nie bestätigt“", () => {
    const [row] = withDerivedUnsicher([
      {
        id: "1",
        term: "venir",
        translation: "kommen",
        recognition_uncertain: true,
        confirmed_at: null,
      },
    ]);
    expect(row!.unsicher).toBe(true);
  });
});

describe("sortForReview", () => {
  it("zieht unsichere Zeilen nach oben, der Rest bleibt alphabetisch", () => {
    const items: VocabRow[] = [
      { id: "a", term: "zebra", translation: "Zebra", unsicher: false },
      { id: "b", term: "apfel", translation: "", unsicher: true },
      { id: "c", term: "birne", translation: "Birne", unsicher: false },
    ];
    expect(sortForReview(items).map((r) => r.term)).toEqual(["apfel", "birne", "zebra"]);
  });
});
