/**
 * Einfügen mit Trennzeichen-Erkennung (V-03a, ADR 0007 D1).
 *
 * Deckt Excel/Sheets (Tab), CSV (Semikolon) und getippte Listen (Gedankenstrich,
 * Komma) ab, ohne Datei-Upload oder Spaltenzuordnung – „ein Einfügefeld … deckt
 * Excel, Google Sheets, Word-Tabellen und getippte Listen ab".
 *
 * Pro Zeile, nicht ein Trennzeichen für den ganzen Text: Eine eingefügte Liste
 * ist selten vollständig einheitlich, und eine einzelne krumme Zeile soll die
 * anderen nicht mitreißen.
 */

export type PastedRow = {
  term: string;
  translation: string;
  /** Kein Trennzeichen erkannt – die Zeile braucht einen Blick, bevor sie zählt. */
  unsicher: boolean;
};

// Reihenfolge nach Zuverlässigkeit: Tab (Tabellen-Copy) vor Semikolon (CSV) vor
// Gedankenstrich/Bindestrich (getippte Listen) vor Komma (mehrdeutig – ein Wort
// oder eine Übersetzung kann selbst ein Komma enthalten).
const DELIMITERS = ["\t", ";", " – ", " - ", ","];

function splitLine(line: string): PastedRow {
  for (const delimiter of DELIMITERS) {
    const parts = line
      .split(delimiter)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length === 2) {
      return { term: parts[0]!, translation: parts[1]!, unsicher: false };
    }
  }
  // Kein Trennzeichen hat sauber in zwei Teile gesplittet – die ganze Zeile
  // steht erst mal als Wort da, Übersetzung leer, zur Prüfung markiert.
  return { term: line.trim(), translation: "", unsicher: true };
}

export function parsePastedVocabulary(text: string): PastedRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(splitLine);
}
