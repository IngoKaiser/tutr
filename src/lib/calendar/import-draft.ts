import type { CalendarEventType } from "./upcoming";

/**
 * Die kanalneutrale Entwurfsform für den Kalender-Import (K-02b, ADR 0016
 * D1). Bild-Import (K-03) und Datei-Import (K-04) füllen dieselbe Form; der
 * Review-Screen (K-02c) kennt seine Quelle danach nicht mehr.
 *
 * Bezeichner englisch wie überall im Lib-Code (CLAUDE.md) – das ist die
 * interne Form **nach** der Erkennung. Die Zod-Schemas der KI-Schicht davor
 * dürfen wie `homeworkExtractionSchema()` deutsche Feldnamen tragen (`fach`),
 * weil das Modell in dieser Sprache antwortet; hier gilt CLAUDE.md ohne
 * Ausnahme.
 *
 * Rein – kein Bezug zu `calendar_event`-Spaltennamen oder einer Datenbank.
 */
export type CalendarImportDraft = {
  /** `"blocker"` ist kein `calendar_event`-Typ (ADR 0016 D5) – wird erkannt, nicht gespeichert. */
  type: CalendarEventType | "blocker";
  /**
   * Fachname wie im Import erkannt, `"unklar"` wenn nicht zuordenbar,
   * `null` nur bei `type: "blocker"` (Blocker haben kein Fach). Auflösung zu
   * einer `subject_id` ist Sache des Aufrufers (D4) – diese Form kennt keine
   * IDs.
   */
  subjectGuess: string | "unklar" | null;
  title: string;
  /** Kürzerer Titel fürs Kind, falls die Quelle einen anbietet (z. B. „Mathe Nr. 1"). */
  displayName: string | null;
  /** ISO-Datum `YYYY-MM-DD`. */
  date: string;
  /** Rohe Gruppentokens wie erkannt, z. B. `["8.5", "8.5 Eng"]`. Leer = betrifft alle. */
  groups: string[];
  /**
   * Eigene Gruppe **und** Lernbezug (ADR 0016 D3) – kein reines
   * Gruppenfilter-Ergebnis. `matchesOwnGroups()` (`group-match.ts`) liefert
   * nur die Gruppen-Hälfte davon; „hat diese Zeile überhaupt Lernbezug"
   * (z. B. „Tag der offenen Tür" hat keinen) entscheidet die Erkennung.
   */
  relevant: boolean;
  /** KW-Mismatch, schlecht lesbarer Text (ADR 0016 D6) – wie bei `homeworkExtractionSchema()`. */
  confidence: "hoch" | "niedrig";
  note: string | null;
};
