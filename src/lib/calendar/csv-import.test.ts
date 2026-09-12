import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { csvToDrafts, parseCsv } from "./csv-import";

// Kein `?raw`-Import (Vite-Spezifikum ohne Typdeklaration hier) – die
// Fixture ist eine echte Textdatei, `readFileSync` reicht.
const fixtureCsv = readFileSync(
  join(import.meta.dirname, "../../../docs/fixtures/beispiel-import-klausurplan.csv"),
  "utf-8",
);

const FAECHER = ["Französisch", "Englisch", "Deutsch", "Mathematik", "Biologie"];

describe("parseCsv", () => {
  test("erkennt Semikolon als Trennzeichen (deutsches Excel)", () => {
    expect(parseCsv("Datum;Titel\n25.09.2026;Test")).toEqual([
      ["Datum", "Titel"],
      ["25.09.2026", "Test"],
    ]);
  });

  test("erkennt Komma, wenn es überwiegt", () => {
    expect(parseCsv("Datum,Titel\n25.09.2026,Test")).toEqual([
      ["Datum", "Titel"],
      ["25.09.2026", "Test"],
    ]);
  });

  test("Anführungszeichen schützen das Trennzeichen im Feld", () => {
    expect(parseCsv('Datum,Titel\n25.09.2026,"Mathe, Klasse 8.5"')).toEqual([
      ["Datum", "Titel"],
      ["25.09.2026", "Mathe, Klasse 8.5"],
    ]);
  });

  test('doppeltes "" ist ein escapetes Anführungszeichen', () => {
    expect(parseCsv('Datum,Titel\n25.09.2026,"Sag ""Hallo"""')).toEqual([
      ["Datum", "Titel"],
      ["25.09.2026", 'Sag "Hallo"'],
    ]);
  });

  test("leere Zeilen fallen weg", () => {
    expect(parseCsv("Datum;Titel\n\n25.09.2026;Test\n")).toEqual([
      ["Datum", "Titel"],
      ["25.09.2026", "Test"],
    ]);
  });
});

describe("csvToDrafts", () => {
  test("Kopfzeile ohne Datum/Titel bricht mit Meldung ab", () => {
    const result = csvToDrafts("Fach;Art\nMathe;Test", FAECHER);
    expect(result.drafts).toEqual([]);
    expect(result.fehler).toHaveLength(1);
  });

  test("liest die Beispiel-Fixture", () => {
    const result = csvToDrafts(fixtureCsv, FAECHER);
    expect(result.fehler).toEqual([]);
    expect(result.drafts).toHaveLength(6);

    const frz = result.drafts.find((d) => d.title === "Jg. 8 Frz. Arbeit");
    expect(frz).toMatchObject({
      type: "klassenarbeit",
      subjectGuess: "Französisch",
      date: "2026-09-25",
      groups: ["8.1", "8.2", "8.3", "8.4", "8.5"],
      relevant: true,
    });

    // Abkürzung "Eng" → "Englisch" (ADR 0016 D4), kein Modellaufruf.
    const eng = result.drafts.find((d) => d.title === "Englischarbeit Nr.1");
    expect(eng?.subjectGuess).toBe("Englisch");

    const blocker = result.drafts.filter((d) => d.type === "blocker");
    expect(blocker.map((b) => b.title).sort()).toEqual(["Herbstferien", "Projektwoche"]);
    expect(blocker.every((b) => b.subjectGuess === null)).toBe(true);

    // "Tag der offenen Tür" hat keinen erkennbaren Typ → sonstiges, nicht relevant.
    const tdot = result.drafts.find((d) => d.title === "Tag der offenen Tür CvO");
    expect(tdot).toMatchObject({ type: "sonstiges", relevant: false });
  });
});
