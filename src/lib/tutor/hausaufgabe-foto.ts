import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "@anthropic-ai/sdk";

/**
 * Ordnet einen gescheiterten Aufgaben-Erkennungs-Aufruf einer verständlichen
 * Meldung zu (T-03 PR 2) – dieselbe Idee wie `lib/vocab/photo.ts`
 * `classifyPhotoImportError()`, aber mit Hausaufgaben-Wortlaut statt
 * „tippe die Zeilen": Für eine Hausaufgabe gibt es keine Texteingabe als
 * Ausweichweg, nur ein neuer Versuch mit dem Foto.
 *
 * Getrennt von der Server Action, damit sich die Zuordnung ohne API-Zugriff
 * testen lässt – mit echten Fehlerobjekten aus dem SDK, nicht nachgebauten.
 */
export type HomeworkPhotoFailure = {
  /** Deutscher Text für die Oberfläche – nie Details aus `error`. */
  fehler: string;
  /** Kurzer technischer Grund fürs Serverlog, nie für die Oberfläche. */
  ursache: string;
};

export function classifyHomeworkPhotoError(error: unknown): HomeworkPhotoFailure {
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
    const serverseitig = error.status !== undefined && error.status >= 500;
    return {
      fehler: serverseitig
        ? "Die Bilderkennung ist gerade nicht erreichbar. Versuch es gleich noch einmal."
        : "Die Bilderkennung hat nicht geklappt. Versuch es mit einem schärferen Foto noch einmal.",
      ursache: `${error.constructor.name} (${error.status ?? "unbekannt"})`,
    };
  }
  return {
    fehler: "Die Bilderkennung hat nicht geklappt. Versuch es noch einmal.",
    ursache: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  };
}
