/**
 * Vorschlagswerte für ein neues Schuljahr (F-16b, §9 Sommer-Assistent).
 *
 * Nur die Vorschläge – **nicht** die automatische Erinnerung nahe
 * Schuljahresende und nicht der geführte Abgleich „neue/weggefallene Fächer
 * und Lehrwerke". Beides ist F-16c: Der Zeitpunkt-Trigger lässt sich vor dem
 * nächsten Sommer nicht gegen echte Nutzung prüfen, und den Fächer-Abgleich
 * deckt `/faecher` bereits ab – ADR 0009 D2 sagt ausdrücklich „neues Jahr
 * heißt: leere Fächerliste, sie wählt, was sie belegt".
 *
 * Rechnet aus dem **bisherigen** Schuljahr, nicht aus dem heutigen Datum:
 * Wer manuell ein neues Jahr eröffnet, tut das nicht zwingend am 1. August.
 */
export type SchoolYearBasis = {
  startDate: string; // ISO-Datum, `YYYY-MM-DD`
  gradeLevel: number;
  className: string | null;
};

export type SchoolYearSuggestion = {
  label: string;
  startDate: string;
  endDate: string;
  gradeLevel: number;
  className: string | null;
};

const MAX_GRADE_LEVEL = 13;

/** Label und Zeitraum des Jahres, das auf `startDate` folgt – reine Datumsrechnung. */
export function nextSchoolYearWindow(startDate: string): {
  label: string;
  startDate: string;
  endDate: string;
} {
  const previousStartYear = Number(startDate.slice(0, 4));
  const startYear = previousStartYear + 1;
  const endYear = startYear + 1;

  return {
    label: `${startYear}/${String(endYear % 100).padStart(2, "0")}`,
    startDate: `${startYear}-08-01`,
    endDate: `${endYear}-07-31`,
  };
}

/** Vollständiger Formular-Vorschlag fürs neue Jahr, inklusive Jahrgang/Klasse. */
export function suggestNextSchoolYear(current: SchoolYearBasis): SchoolYearSuggestion {
  return {
    ...nextSchoolYearWindow(current.startDate),
    gradeLevel: Math.min(current.gradeLevel + 1, MAX_GRADE_LEVEL),
    className: current.className,
  };
}
