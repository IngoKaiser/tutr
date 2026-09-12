import { matrixToDrafts, type MatrixImportErgebnis } from "./row-import";

/**
 * CSV-Import Klausurplan (K-04, §6 M7, ADR 0016). Deutsche Exporte (Excel)
 * trennen meist mit Semikolon, weil Komma der Dezimaltrenner ist –
 * `erkenneTrennzeichen()` zählt beide in der Kopfzeile und nimmt das
 * häufigere, statt eins fest anzunehmen.
 *
 * Die Kopfzeilen-Zuordnung und Zeilen-Erkennung teilt sich mit
 * `xlsx-import.ts` in `row-import.ts`s `matrixToDrafts()` – ein XLSX-Blatt
 * ist am Ende dieselbe Zellenmatrix wie ein geparstes CSV.
 */

/** Trennzeichen aus der Kopfzeile ableiten: das häufigere von Komma/Semikolon, im Zweifel Komma. */
function erkenneTrennzeichen(kopfzeile: string): "," | ";" {
  const semikolons = (kopfzeile.match(/;/g) ?? []).length;
  const kommas = (kopfzeile.match(/,/g) ?? []).length;
  return semikolons > kommas ? ";" : ",";
}

/**
 * Ein CSV-Text → Zeilen aus Feldern. RFC-4180-ähnlich: Felder in
 * Anführungszeichen dürfen das Trennzeichen und Zeilenumbrüche enthalten,
 * `""` darin ist ein escapetes Anführungszeichen.
 */
export function parseCsv(text: string): string[][] {
  const bereinigt = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const ersteZeile = bereinigt.slice(0, bereinigt.indexOf("\n") + 1 || bereinigt.length);
  const trennzeichen = erkenneTrennzeichen(ersteZeile);

  const zeilen: string[][] = [];
  let feld = "";
  let zeile: string[] = [];
  let inAnfuehrungszeichen = false;

  for (let i = 0; i < bereinigt.length; i++) {
    const zeichen = bereinigt[i]!;
    if (inAnfuehrungszeichen) {
      if (zeichen === '"') {
        if (bereinigt[i + 1] === '"') {
          feld += '"';
          i++;
        } else {
          inAnfuehrungszeichen = false;
        }
      } else {
        feld += zeichen;
      }
      continue;
    }

    if (zeichen === '"') {
      inAnfuehrungszeichen = true;
    } else if (zeichen === trennzeichen) {
      zeile.push(feld);
      feld = "";
    } else if (zeichen === "\n") {
      zeile.push(feld);
      zeilen.push(zeile);
      zeile = [];
      feld = "";
    } else {
      feld += zeichen;
    }
  }
  if (feld.length > 0 || zeile.length > 0) {
    zeile.push(feld);
    zeilen.push(zeile);
  }

  return zeilen.filter((z) => z.some((f) => f.trim().length > 0));
}

export type CsvImportErgebnis = MatrixImportErgebnis;

/** CSV-Text → Entwürfe (siehe `matrixToDrafts()` für die Kopfzeilen-Regeln). */
export function csvToDrafts(text: string, subjectNames: readonly string[]): CsvImportErgebnis {
  return matrixToDrafts(parseCsv(text), subjectNames);
}
