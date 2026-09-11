import { sql } from "drizzle-orm";

import type { Transaction } from "@/db/actor";

/**
 * Fach-Zuordnung (T-13, ADR 0013 D2/D7): die Fächerliste laden, die
 * Modellantwort auf eine Fach-ID abbilden.
 *
 * Zwei Aufrufer teilen sich das – die freie Chat-Zuordnung
 * (`api/tutor/route.ts`) und die Fach-Erkennung aus dem Hausaufgaben-Foto
 * (`hausaufgabe/actions.ts`, D7) – deshalb hier statt in einer der beiden
 * Dateien. Dieselbe Überlegung wie bei `lib/ai/rate-limit.ts`: reine
 * Funktionen und ein kurzer, lesender DB-Zugriff in einer Datei, wenn beides
 * zusammengehört.
 */

export type FachOption = { id: string; name: string; language: string | null };

/** Die Fächer des Kindes im aktuellen Schuljahr – die Auswahl für jede Fach-Zuordnung. */
export async function ladeFaecherFuerZuordnung(tx: Transaction): Promise<FachOption[]> {
  return tx.execute<FachOption>(sql`
    select s.id, s.name, s.language from subject s
    join school_year_subject sys on sys.subject_id = s.id
    join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'`);
}

/**
 * Bildet das Ergebnis der Fach-Zuordnung auf eine Fach-ID ab.
 *
 * **Die geschlossene Auswahl wird hier erzwungen, nicht im Prompt.** Ein
 * Prompt ist eine Bitte; diese Funktion ist die Garantie. `fachZuordnungSchema()`
 * (und `homeworkExtractionSchema()`) grenzen die Modellantwort bereits über
 * Structured Output auf die übergebenen Namen plus `"unklar"` ein – trifft
 * trotzdem kein Eintrag der Liste exakt zu (unterschiedliche Normalisierung,
 * ein Fach, das zwischen Aufruf und Antwort verschwunden ist), ist das
 * Ergebnis `null`, nie ein geratener Treffer.
 */
export function loeseFachZuordnungAuf(
  antwort: string,
  faecher: readonly FachOption[],
): FachOption | null {
  return faecher.find((f) => f.name === antwort) ?? null;
}
