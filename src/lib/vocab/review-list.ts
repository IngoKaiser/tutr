/**
 * Die Vokabelliste zum Durchsehen (ADR 0007 D2).
 *
 * Rein und unit-testbar. Wird von zwei Ansichten geteilt: der Liste eines
 * Sets (`[setId]`, V-03a) und der Liste der Vokabeln **ohne** Set
 * (`ohne-set`, V-03d). Beide zeigen dieselben drei „prüfen"-Gründe und
 * dieselbe Sortierung – unsichere Zeilen zuerst, dahin gehört der Blick.
 */

export type VocabRow = {
  id: string;
  term: string;
  translation: string;
  unsicher: boolean;
};

/** Unsichere Zeilen zuerst, sonst alphabetisch nach Wort. */
export function sortForReview(items: VocabRow[]): VocabRow[] {
  return [...items].sort((a, b) => {
    if (a.unsicher !== b.unsicher) return a.unsicher ? -1 : 1;
    return a.term.localeCompare(b.term, "de");
  });
}

/**
 * Die drei Gründe aus ADR 0007 D2, warum eine Zeile „prüfen" trägt.
 *
 * Zwei davon werden hier **abgeleitet** (ADR 0006 D7): ein leeres Feld und
 * dasselbe Wort mit verschiedenen Übersetzungen in der Liste. Der dritte –
 * niedrige Konfidenz der Erkennung – kommt als gespeicherte Spalte dazu:
 * Er ist eine Tatsache aus dem Moment des Imports, die sich später aus der
 * Zeile nicht mehr ablesen lässt („la trousse / das Fed" sieht vollständig
 * aus). Gefunden beim Testen von V-03b gegen die echte Bilderkennung.
 */
export function withDerivedUnsicher(
  rows: { id: string; term: string; translation: string; recognition_uncertain: boolean }[],
): VocabRow[] {
  const termCounts = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.term.trim().toLowerCase();
    const translations = termCounts.get(key) ?? new Set();
    translations.add(row.translation.trim().toLowerCase());
    termCounts.set(key, translations);
  }
  return rows.map(({ recognition_uncertain, ...row }) => {
    const key = row.term.trim().toLowerCase();
    const leer = row.term.trim() === "" || row.translation.trim() === "";
    const uneinig = (termCounts.get(key)?.size ?? 0) > 1;
    return { ...row, unsicher: leer || uneinig || recognition_uncertain };
  });
}
