/**
 * Prompt für die Foto-Erkennung einer Hausaufgabe (T-03, §4a Schritt 1;
 * Fach-Zuordnung seit T-13, ADR 0013 D7).
 *
 * Als Funktion mit typisierten Parametern, System- und Nutzerteil getrennt
 * (`src/ai/prompts/README.md`). Das Bild ist Nutzereingabe und steht nie im
 * Systemprompt.
 */

export type HomeworkExtractionContext = {
  /**
   * Die Fächer des Kindes im aktuellen Schuljahr (ADR 0013 D7) – dieselbe
   * geschlossene Auswahl wie bei der Fach-Zuordnung im freien Chat
   * (`ai/prompts/fach-zuordnung.ts`), nur ohne eigenen Modellaufruf: Das Foto
   * geht ohnehin durch Vision.
   */
  faecher: readonly string[];
};

/**
 * Vier Dinge stehen hier, weil sie sonst schiefgehen:
 *
 * 1. **Nicht lösen.** Ein Modell, das eine Aufgabe sieht, will sie
 *    beantworten. Käme die Lösung schon im Import mit, wäre §4a an der
 *    ersten Stelle ausgehebelt, an der es zählt.
 * 2. **Trennen, nicht zusammenfassen.** „Nr. 5 a–c“ sind drei Aufgaben,
 *    nicht eine. Der Ablauf aus §4a arbeitet eine nach der anderen ab;
 *    zusammengefasste Aufgaben machen die Hinweisleiter sinnlos.
 * 3. **Nichts erfinden.** Ein abgeschnittener Aufgabentext mit `niedrig`
 *    ist brauchbar – ein plausibel ergänzter ist eine falsche Aufgabe, die
 *    niemandem auffällt.
 * 4. **Das Fach nicht raten.** Dieselbe Regel wie bei der Fach-Zuordnung im
 *    freien Chat: `"unklar"` ist ein erlaubtes Ergebnis, kein falsches Fach.
 */
export function homeworkExtractionSystemPrompt({ faecher }: HomeworkExtractionContext): string {
  return [
    "Du liest Hausaufgaben aus Fotos – Buchseiten, Arbeitsblätter, Hefteinträge, Tafelbilder.",
    "",
    `Ordne außerdem zu, zu welchem Fach das Blatt gehört: ${faecher.join(", ")}.`,
    'Gib genau einen dieser Fachnamen zurück – buchstabengetreu, wie oben geschrieben – oder "unklar", wenn es sich nicht eindeutig einem davon zuordnen lässt. Rate nicht.',
    "",
    "Gib jede Aufgabe einzeln zurück:",
    '- "label" ist die Nummer, wie sie dasteht: "5a", "Nr. 7", "2". Steht keine da, lass es leer.',
    '- "prompt" ist der Aufgabentext, so vollständig wie er lesbar ist.',
    "- Teilaufgaben sind eigene Aufgaben. „Nr. 5 a–c“ sind drei Einträge, nicht einer.",
    "- Die Reihenfolge ist die auf dem Blatt.",
    "",
    "**Löse nichts.** Du legst nur die Liste an. Keine Ergebnisse, keine Rechenwege, keine Tipps – auch dann nicht, wenn die Aufgabe leicht ist.",
    "",
    "Rate nie.",
    '- Ist ein Text schlecht lesbar oder abgeschnitten, gib zurück, was du erkennst, und setze "confidence" auf "niedrig".',
    '- Eine unvollständige Aufgabe mit "niedrig" ist richtig. Eine ergänzte mit "hoch" ist ein Fehler.',
    "",
    "Was keine Aufgabe ist, bleibt draußen: Überschriften, Seitenzahlen, Merkkästen, Lösungsteile, Beispielrechnungen des Buches, Arbeitsanweisungen an die ganze Klasse ohne konkrete Aufgabe.",
  ].join("\n");
}

/** Der Text neben dem Bild. Kurz: Die Arbeit steht im Systemprompt. */
export function homeworkExtractionUserPrompt(): string {
  return "Lies die Aufgaben aus diesem Bild.";
}
