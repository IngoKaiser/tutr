import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "@anthropic-ai/sdk";

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

export type PhotoImportFailure = {
  /** Deutscher Text für die Oberfläche – nie Details aus `error`. */
  fehler: string;
  /** Kurzer technischer Grund fürs Serverlog, nie für die Oberfläche. */
  ursache: string;
};

/**
 * Ordnet einen gescheiterten Bilderkennungs-Aufruf einer verständlichen
 * Meldung zu (V-03c).
 *
 * Vorher stand in `addFromPhoto()` ein `catch {}` ohne Bindung – der
 * ursprüngliche Fehler war in dem Moment weg, in dem er auftrat, mit dem
 * Kommentar „gehört ins Serverlog" darüber, obwohl nirgends geloggt wurde.
 * Als am 9. September ein Doppelseiten-Import zur Hälfte scheiterte, ließ
 * sich die Ursache deshalb nicht mehr rekonstruieren.
 *
 * Getrennt von der Server Action, damit sich die Zuordnung ohne API-Zugriff
 * testen lässt – mit echten Fehlerobjekten aus dem SDK, nicht nachgebauten.
 */
export function classifyPhotoImportError(error: unknown): PhotoImportFailure {
  if (error instanceof APIConnectionTimeoutError) {
    return {
      fehler: "Die Bilderkennung hat zu lange gebraucht. Versuch es noch einmal.",
      ursache: "Zeitüberschreitung",
    };
  }
  if (error instanceof APIConnectionError) {
    return {
      fehler: "Die Verbindung zur Bilderkennung ist abgebrochen. Versuch es noch einmal.",
      ursache: "Verbindungsabbruch",
    };
  }
  if (error instanceof RateLimitError) {
    return {
      fehler:
        "Die Bilderkennung ist gerade überlastet. Versuch es in ein paar Sekunden noch einmal.",
      ursache: `Rate Limit (${error.status})`,
    };
  }
  if (error instanceof APIError) {
    // 5xx: Anthropic-seitig, ein erneuter Versuch hilft oft. 4xx (außer dem
    // Rate Limit oben): eher das Bild oder die Anfrage selbst – derselbe
    // Text wie beim generischen Fehler unten, aber mit genauerer Ursache.
    const serverseitig = error.status !== undefined && error.status >= 500;
    return {
      fehler: serverseitig
        ? "Die Bilderkennung ist gerade nicht erreichbar. Versuch es gleich noch einmal."
        : "Die Bilderkennung hat nicht geklappt. Versuch es noch einmal oder tippe die Zeilen.",
      ursache: `${error.constructor.name} (${error.status ?? "unbekannt"})`,
    };
  }
  return {
    fehler: "Die Bilderkennung hat nicht geklappt. Versuch es noch einmal oder tippe die Zeilen.",
    ursache: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  };
}
