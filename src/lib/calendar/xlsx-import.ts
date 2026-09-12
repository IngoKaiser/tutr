import ExcelJS from "exceljs";

import { matrixToDrafts, type MatrixImportErgebnis } from "./row-import";

/**
 * XLSX-Import Klausurplan (K-04, §6 M7, ADR 0016). `exceljs` (neu, MIT) statt
 * eines Eigenbaus – XLSX ist ein ZIP/XML-Binärformat, das von Hand zu
 * parsen unverhältnismäßig wäre (CLAUDE.md: neue Dependency nur nach
 * Rückfrage, hier eingeholt).
 *
 * Liest das **erste** Arbeitsblatt, erste Zeile = Kopfzeile – dieselbe
 * Kopfzeilen-Zuordnung wie beim CSV-Import (`row-import.ts`s
 * `matrixToDrafts()`).
 */

/** Eine Excel-Zelle in Text: Datumszellen kommen als `Date`-Objekt, nicht als String. */
function zelleAlsText(wert: ExcelJS.CellValue): string {
  if (wert === null || wert === undefined) return "";
  if (wert instanceof Date) {
    // UTC, wie überall im Kalender-Code (`upcoming.ts`) – Excel liefert
    // Datumszellen ohne Zeitzone, ein lokales `getFullYear()` würde am
    // Tagesrand verschieben.
    const y = wert.getUTCFullYear();
    const m = String(wert.getUTCMonth() + 1).padStart(2, "0");
    const d = String(wert.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof wert === "object" && "text" in wert) return String(wert.text ?? "");
  if (typeof wert === "object" && "result" in wert) return String(wert.result ?? "");
  return String(wert);
}

export type XlsxImportErgebnis = MatrixImportErgebnis;

/** XLSX-Datei (als Buffer) → Entwürfe. `fehler` trägt auch „Datei ließ sich nicht lesen". */
export async function xlsxToDrafts(
  buffer: ArrayBuffer | Buffer,
  subjectNames: readonly string[],
): Promise<XlsxImportErgebnis> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as ArrayBuffer);
  } catch {
    return { drafts: [], fehler: ["Die Datei ließ sich nicht als Excel-Tabelle lesen."] };
  }

  const blatt = workbook.worksheets[0];
  if (!blatt) return { drafts: [], fehler: ["Die Datei enthält kein Arbeitsblatt."] };

  const zeilen: string[][] = [];
  blatt.eachRow((row) => {
    const werte = (row.values as ExcelJS.CellValue[]).slice(1); // Index 0 ist bei exceljs immer leer
    zeilen.push(werte.map(zelleAlsText));
  });

  return matrixToDrafts(zeilen, subjectNames);
}
