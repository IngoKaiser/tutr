import type { ExtractedRow } from "@/ai/schemas/vocab-extraction";

import type { PastedRow } from "./paste";

/**
 * Vom Modell erkannte Zeilen in genau die Form bringen, die `addRows()`
 * schon kennt (V-03b, ADR 0007 D1).
 *
 * Der eigentliche Punkt dieser Datei ist, dass sie so klein ist: Foto,
 * Einfügen und manuelle Eingabe sind „drei Türen in denselben Raum" (ADR
 * 0007). Der Foto-Weg braucht deshalb keinen eigenen Einfügepfad, keine
 * eigene Duplikaterkennung und keine eigene Ansicht – nur diese Abbildung.
 *
 * `confidence: "niedrig"` wird zu `unsicher: true`. Damit landet die Zeile
 * in der Liste oben und trägt „prüfen" (D2), und `addRows()` legt sie als
 * eigene Zeile an, statt sie mit einer vorhandenen Vokabel zu verknüpfen:
 * Was das Modell nicht sicher lesen konnte, darf nicht stillschweigend auf
 * eine bestehende Vokabel gezogen werden.
 *
 * Rein und ohne Netz – damit prüfbar, ohne ein Modell zu befragen.
 */
export function extractedRowsToPastedRows(rows: ExtractedRow[]): PastedRow[] {
  return (
    rows
      .map((row) => ({
        term: row.term.trim(),
        translation: row.translation.trim(),
        unsicher: row.confidence === "niedrig",
      }))
      // Eine Zeile ohne Wort ist keine Vokabel, sondern Rauschen – die
      // Übersetzung allein trüge nichts, was man später vervollständigen
      // könnte. Andersherum bleibt eine Zeile mit Wort und ohne Übersetzung
      // ausdrücklich erhalten: Genau die soll man in der Liste ergänzen.
      .filter((row) => row.term.length > 0)
  );
}
