import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";

import { xlsxToDrafts } from "./xlsx-import";

const FAECHER = ["Französisch", "Englisch", "Deutsch", "Mathematik", "Biologie"];

/** Baut ein XLSX im Arbeitsspeicher – kein binäres Fixture-File nötig, `exceljs` schreibt es hier selbst. */
async function buildWorkbook(rows: (string | Date)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Klausurplan");
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe("xlsxToDrafts", () => {
  test("liest ein Arbeitsblatt mit echten Datumszellen", async () => {
    const buffer = await buildWorkbook([
      ["Datum", "Fach", "Art", "Titel", "Gruppe"],
      [
        new Date(Date.UTC(2026, 8, 25)),
        "Französisch",
        "Klassenarbeit",
        "Jg. 8 Frz. Arbeit",
        "8.1, 8.5",
      ],
      [new Date(Date.UTC(2026, 9, 12)), "", "Projektwoche", "Projektwoche", ""],
    ]);

    const result = await xlsxToDrafts(buffer, FAECHER);
    expect(result.fehler).toEqual([]);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]).toMatchObject({
      type: "klassenarbeit",
      subjectGuess: "Französisch",
      date: "2026-09-25",
      groups: ["8.1", "8.5"],
    });
    expect(result.drafts[1]).toMatchObject({
      type: "blocker",
      subjectGuess: null,
      date: "2026-10-12",
    });
  });

  test("fehlende Datum/Titel-Spalte bricht mit Meldung ab", async () => {
    const buffer = await buildWorkbook([
      ["Fach", "Art"],
      ["Mathe", "Test"],
    ]);
    const result = await xlsxToDrafts(buffer, FAECHER);
    expect(result.drafts).toEqual([]);
    expect(result.fehler).toHaveLength(1);
  });

  test("keine Excel-Datei → verständliche Fehlermeldung statt Absturz", async () => {
    const result = await xlsxToDrafts(new TextEncoder().encode("kein excel").buffer, FAECHER);
    expect(result.drafts).toEqual([]);
    expect(result.fehler).toHaveLength(1);
  });
});
