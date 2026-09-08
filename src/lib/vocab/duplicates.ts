import { normalize } from "./answer";

/**
 * Duplikaterkennung (V-03a, ADR 0007 D4): „Duplikat heißt zweimal derselbe
 * Eintrag, nicht in zwei Sets."
 *
 * - **exakt**: Wort und Übersetzung stimmen (normalisiert) überein → kein
 *   neuer Eintrag, nur die Set-Mitgliedschaft ergänzen. Der Lernstand des
 *   bestehenden Eintrags bleibt unangetastet.
 * - **abweichend**: gleiches Wort, andere Übersetzung → nicht automatisch
 *   zusammenführen. Die Erkennung läuft automatisch, die Entscheidung nicht.
 * - **neu**: kein Treffer.
 */

export type DuplicateClassification = "neu" | "exakt" | "abweichend";

export type ExistingVocabItem = { id: string; term: string; translation: string };

export type DuplicateResult = {
  classification: DuplicateClassification;
  match: ExistingVocabItem | null;
};

export function classifyDuplicate(
  candidate: { term: string; translation: string },
  existing: ExistingVocabItem[],
): DuplicateResult {
  const candidateTerm = normalize(candidate.term);
  const candidateTranslation = normalize(candidate.translation);

  const sameTerm = existing.filter((item) => normalize(item.term) === candidateTerm);
  if (sameTerm.length === 0) return { classification: "neu", match: null };

  // Erst nach einem exakten Treffer suchen, dann erst „abweichend" melden:
  // D4 erlaubt ausdrücklich zwei Einträge zum selben Wort („aller/gehen" und
  // „aller/fahren"). Die erste Zeile zu nehmen, würde beim zweiten Einfügen
  // derselben Liste einen dritten Eintrag anlegen.
  const exact = sameTerm.find((item) => normalize(item.translation) === candidateTranslation);
  if (exact) return { classification: "exakt", match: exact };

  return { classification: "abweichend", match: sameTerm[0]! };
}
