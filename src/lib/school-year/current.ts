/**
 * Das aktuelle Schuljahr aus einem Datum ableiten (F-16a).
 *
 * Ein Schuljahr läuft bundesweit vom 1. August bis zum 31. Juli des
 * Folgejahres – keine Bundesland-Abweichung (die kommt erst mit
 * `school_profile`, F-04d). Vor dem 1. August zählt noch das Jahr, das im
 * Sommer davor begann.
 *
 * Rechnet in UTC, nicht in der Serverzeitzone: Ein Vercel-Server läuft
 * ohnehin in UTC, aber die Funktion soll unabhängig vom Prozessstandort
 * dasselbe Ergebnis liefern – ein Datumsschnitt, der von der lokalen
 * Zeitzone des Servers abhinge, wäre eine unsichtbare Fehlerquelle.
 */
export type CurrentSchoolYear = {
  /** „2026/27" – die Kurzform, wie sie auch im Seed steht. */
  label: string;
  /** ISO-Datum (`YYYY-MM-DD`), 1. August. */
  startDate: string;
  /** ISO-Datum (`YYYY-MM-DD`), 31. Juli des Folgejahres. */
  endDate: string;
};

const AUGUST = 7; // Date.getUTCMonth() ist nullbasiert.

export function currentSchoolYear(now: Date): CurrentSchoolYear {
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= AUGUST ? year : year - 1;
  const endYear = startYear + 1;

  return {
    label: `${startYear}/${String(endYear % 100).padStart(2, "0")}`,
    startDate: `${startYear}-08-01`,
    endDate: `${endYear}-07-31`,
  };
}
