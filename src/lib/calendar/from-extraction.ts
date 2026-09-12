import type { ExtractedCalendarEvent } from "@/ai/schemas/calendar-extraction";

import type { CalendarImportDraft } from "./import-draft";

/**
 * Rohes Vision-Ergebnis (`calendarExtractionSchema()`, deutsche Feldnamen
 * wie das Modell sie liefert) → `CalendarImportDraft` (K-02b, englische
 * Bezeichner). Rein: kein Netz, keine Datenbank.
 *
 * **`relevant` trägt hier nur die Lernbezug-Hälfte** (`hatLernbezug`) – die
 * Gruppen-Hälfte fehlt an dieser Stelle notwendig: Das Modell kennt die
 * eigenen Gruppen des Kindes nicht, die stehen bei einer Ersteinrichtung
 * erst **nach** diesem Aufruf fest (ADR 0016 D3). Der Aufrufer (Review-
 * Screen) verknüpft `matchesOwnGroups(draft.groups, ownGroups)` selbst dazu,
 * sobald `ownGroups` bekannt ist – diese Funktion tut nur ihren Teil.
 */
export function extractedEventsToDrafts(events: ExtractedCalendarEvent[]): CalendarImportDraft[] {
  return events.map((event) => ({
    type: event.typ,
    subjectGuess: event.fach,
    title: event.titel.trim(),
    displayName: nichtLeer(event.anzeigename),
    date: event.datum,
    groups: event.gruppen,
    relevant: event.hatLernbezug,
    confidence: event.confidence,
    note: nichtLeer(event.hinweis),
  }));
}

function nichtLeer(value: string | null): string | null {
  if (value === null) return null;
  const getrimmt = value.trim();
  return getrimmt.length > 0 ? getrimmt : null;
}
