/**
 * Bildet das Ergebnis der Fach-Zuordnung auf eine Fach-ID ab (T-13,
 * ADR 0013 D2).
 *
 * **Die geschlossene Auswahl wird hier erzwungen, nicht im Prompt.** Ein
 * Prompt ist eine Bitte; diese Funktion ist die Garantie. `fachZuordnungSchema()`
 * grenzt die Modellantwort bereits über Structured Output auf die
 * übergebenen Namen plus `"unklar"` ein – trifft trotzdem kein Eintrag der
 * Liste exakt zu (unterschiedliche Normalisierung, ein Fach, das zwischen
 * Aufruf und Antwort verschwunden ist), ist das Ergebnis `null`, nie ein
 * geratener Treffer.
 */

export type FachOption = { id: string; name: string; language: string | null };

export function loeseFachZuordnungAuf(
  antwort: string,
  faecher: readonly FachOption[],
): FachOption | null {
  return faecher.find((f) => f.name === antwort) ?? null;
}
