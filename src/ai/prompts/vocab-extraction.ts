/**
 * Prompt für die Foto-Extraktion von Vokabeln (V-03b, ADR 0007 D1).
 *
 * Als Funktion mit typisierten Parametern, System- und Nutzerteil getrennt
 * (`src/ai/prompts/README.md`). Das Bild selbst ist Nutzereingabe und steht
 * deshalb nie im Systemprompt.
 */

export type VocabExtractionContext = {
  /** Das Fach, in das eingefügt wird – „Französisch", „Englisch", … */
  subjectName: string;
};

/**
 * Der Systemprompt. Drei Dinge stehen hier, weil sie sonst schiefgehen:
 *
 * 1. **Nichts erfinden.** Ein Modell, das eine unleserliche Zeile „sinnvoll"
 *    ergänzt, erzeugt eine Vokabel, die das Kind so nie gelernt hat – und die
 *    in der Liste nicht als falsch auffällt, weil sie plausibel aussieht. Eine
 *    leere Übersetzung mit `niedrig` ist immer besser als eine geratene.
 * 2. **Was keine Vokabel ist, bleibt draußen** – Seitenzahlen, Überschriften,
 *    Kapitelnummern, Grammatikkästen. D2 erlaubt zwar, solche Zeilen später
 *    zu löschen, aber sie gar nicht erst anzulegen ist weniger Arbeit.
 * 3. **Die Richtung.** Links steht in Vokabelheften und Lehrwerken die
 *    Fremdsprache, rechts die Übersetzung – aber nicht immer. Deshalb die
 *    Regel über die Sprache statt über die Spalte.
 */
export function vocabExtractionSystemPrompt({ subjectName }: VocabExtractionContext): string {
  return [
    `Du liest Vokabellisten aus Fotos – Buchseiten, Arbeitsblätter oder handgeschriebene Vokabelhefte. Das Fach ist ${subjectName}.`,
    "",
    "Gib jede Vokabelzeile einzeln zurück:",
    `- "term" ist das Wort in der Sprache des Fachs (${subjectName}), "translation" die deutsche Entsprechung.`,
    "- Steht die deutsche Spalte links und die Fremdsprache rechts, drehe die Zuordnung entsprechend um. Die Sprache entscheidet, nicht die Spalte.",
    "- Übernimm Artikel, Akzente und Schreibweise genau so, wie sie dastehen.",
    "",
    "Rate nie.",
    '- Kannst du ein Wort nicht sicher lesen, gib zurück, was du erkennst, und setze "confidence" auf "niedrig".',
    '- Fehlt die Übersetzung auf dem Bild oder ist sie unleserlich, lass "translation" leer und setze "confidence" auf "niedrig".',
    '- Eine leere oder unvollständige Zeile mit "niedrig" ist richtig. Eine erfundene Zeile mit "hoch" ist ein Fehler.',
    "",
    "Nimm nur Vokabeln auf. Seitenzahlen, Überschriften, Kapitelnummern, Grammatikerklärungen und Beispielsätze ohne Übersetzung gehören nicht in die Liste.",
    "",
    'Handschrift ist erwartbar schlechter lesbar als Druck. Das ist kein Grund, weniger Zeilen zurückzugeben – es ist der Grund für "niedrig".',
  ].join("\n");
}

/** Der Text neben dem Bild. Kurz: Die Arbeit steht im Systemprompt. */
export function vocabExtractionUserPrompt(): string {
  return "Lies die Vokabeln aus diesem Bild.";
}
