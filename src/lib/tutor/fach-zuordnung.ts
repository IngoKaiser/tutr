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

/**
 * Der Notnagel-Titel: die erste Frage, auf 60 Zeichen gekürzt.
 *
 * Bis T-19a war das **der** Titel (ADR 0010, „Konsequenzen"). Seit ADR 0014 D2
 * vergibt das Modell ihn – und das hier greift nur noch, wenn dabei nichts
 * herauskam.
 */
export function kuerzeTitel(text: string): string {
  const eine = text.replace(/\s+/g, " ").trim();
  return eine.length <= 60 ? eine : `${eine.slice(0, 57)}…`;
}

/**
 * Macht aus dem rohen Modell-Titel (ADR 0014 D2) den Titel, der in der
 * Historie steht – oder fällt auf die gekürzte Frage zurück.
 *
 * **Was hier zurückgewiesen wird, ist kein Fehler des Modells, sondern die
 * Grenze der Aufgabe.** Ein Gruß hat kein Thema; der Prompt verlangt dafür
 * ausdrücklich einen leeren Titel. Diese Funktion macht daraus keinen Streit,
 * sondern nimmt den Notnagel – dieselbe Haltung wie bei
 * `loeseFachZuordnungAuf()`: lieber der ehrliche Rückfall als ein geratener
 * Treffer.
 *
 * Abgeräumt wird nur, was ein Modell typischerweise mitliefert und was in
 * einer Liste stört: umschließende Anführungszeichen (deutsche wie gerade),
 * ein Schlusspunkt, mehrfache Leerzeichen, Zeilenumbrüche. **Kein**
 * Groß-/Kleinschreibungs-Zurechtrücken: Wenn das Modell „reflexive Verben"
 * schreibt, ist das der Titel, nicht etwas zu Korrigierendes.
 */
export function bereinigeTitel(roh: string, frage: string): string {
  const titel = roh
    .replace(/\s+/g, " ")
    .trim()
    // Anführungszeichen nur, wenn sie den ganzen Titel umschließen – ein
    // Zitat *im* Titel („Der Zauberlehrling“-Analyse) bleibt stehen.
    .replace(/^["'„“”»«](.*)["'„“”»«]$/u, "$1")
    .trim()
    // Ein Schlusspunkt macht aus dem Namen einen Satz; Frage- und
    // Ausrufezeichen dürfen bleiben, die tragen Bedeutung.
    .replace(/\.$/u, "")
    .trim();

  if (titel.length > 0) return titel;

  // Zwei Notnägel, weil die Frage selbst leer sein kann: `liesEingang()`
  // lässt eine Nachricht ohne Text durch, solange ein Foto daranhängt
  // („schau dir das mal an"). Bis T-19a stand in genau diesem Fall eine leere
  // Zeile in der Historie – ein Gespräch ohne Namen, das man nur am Datum
  // wiedererkennt.
  return kuerzeTitel(frage) || "Foto";
}
