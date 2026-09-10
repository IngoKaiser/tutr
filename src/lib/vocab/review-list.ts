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
 *
 * **`confirmed_at` sticht zwei der drei Gründe** (V-09): Wer die Zeile
 * angesehen und für richtig befunden hat, hat damit die Frage beantwortet,
 * die „prüfen" gestellt hat. Nötig wurde das durch `pasar` (= verbringen /
 * passieren): Zwei richtige Übersetzungen desselben Worts lösen „uneinig"
 * aus und blieben sonst für immer markiert – und seit V-09 auch für immer
 * vom Üben ausgeschlossen.
 *
 * **Ein leeres Feld bleibt markiert**, auch bestätigt: Das ist keine
 * Einschätzung, sondern eine Lücke. Die kann man nicht akzeptieren, nur
 * füllen. Das hält die Regel deckungsgleich mit `practiceReadySql`.
 */
export function withDerivedUnsicher(
  rows: {
    id: string;
    term: string;
    translation: string;
    recognition_uncertain: boolean;
    confirmed_at?: Date | string | null;
  }[],
): VocabRow[] {
  const termCounts = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.term.trim().toLowerCase();
    const translations = termCounts.get(key) ?? new Set();
    translations.add(row.translation.trim().toLowerCase());
    termCounts.set(key, translations);
  }
  return rows.map(({ recognition_uncertain, confirmed_at, ...row }) => {
    const key = row.term.trim().toLowerCase();
    const leer = row.term.trim() === "" || row.translation.trim() === "";
    const uneinig = (termCounts.get(key)?.size ?? 0) > 1;
    const bestaetigt = confirmed_at != null;
    return {
      ...row,
      unsicher: leer || (!bestaetigt && (uneinig || recognition_uncertain)),
    };
  });
}
