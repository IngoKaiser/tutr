/**
 * Prompt für die Fach-Zuordnung und den Gesprächstitel (T-13/T-19a, ADR 0013
 * D2 und ADR 0014 D2). System- und Nutzerteil getrennt
 * (`src/ai/prompts/README.md`).
 *
 * Läuft **einmal**, bei der ersten Nachricht eines neuen Gesprächs ohne
 * mitgeschicktes Fach – Haiku (CLAUDE.md: „Haiku für Klassifikation"), nicht
 * das Modell, das die Antwort schreibt: Die eigentliche Antwort soll nicht
 * selbst entscheiden, wo sie einsortiert wird (ADR 0011 D3, der Zustand
 * gehört der App).
 *
 * Der Titel kommt seit T-19a hier mit, statt aus einem zweiten Aufruf: Er
 * hängt an derselben Nachricht und ist dieselbe Art Arbeit. Vorher war der
 * Titel die auf 60 Zeichen abgeschnittene Frage – bei Diktiertem, dem
 * Normalfall am Handy, hörte er mitten im Satz auf.
 */

export type FachZuordnungContext = {
  /** Die Fächer des Kindes im aktuellen Schuljahr – die einzige erlaubte Auswahl neben „unklar". */
  faecher: readonly string[];
  /** Die erste Nachricht des Kindes, unverändert. */
  nachricht: string;
};

export function fachZuordnungSystemPrompt({ faecher }: FachZuordnungContext): string {
  return [
    "Du ordnest die erste Nachricht in einem Lern-Tutor einem Schulfach zu und gibst dem Gespräch einen Titel.",
    `Die möglichen Fächer: ${faecher.join(", ")}.`,
    "",
    "Zum Fach:",
    'Gib genau einen dieser Fachnamen zurück – buchstabengetreu, wie oben geschrieben – oder "unklar".',
    'Gib "unklar", wenn die Nachricht zu keinem der Fächer eindeutig passt, zu mehreren passen könnte, oder allgemeiner Natur ist (ein Gruß, eine Frage zur App selbst, Small Talk).',
    "Rate nicht. Ein falsch zugeordnetes Fach ist schlechter als gar keins.",
    "",
    "Zum Titel:",
    "Zwei bis vier Wörter, die benennen, worum es geht. Deutsch, kein Punkt am Ende, keine Anführungszeichen.",
    'Beispiele: "Lineare Gleichungen", "Reflexive Verben", "Photosynthese", "Gedichtanalyse Expressionismus".',
    // Die Nachricht ist oft diktiert: Rohtext, mittendrin abgebrochen, mit
    // Erkennungsfehlern. Genau daraus soll ein lesbarer Titel werden – das
    // ist der Punkt der Übung, nicht ein Hindernis.
    "Benenne das Thema, wiederhole nicht die Frage. Aus „Erkläre mir mal wie das geht mit den linearen Gleichungen ich versteh das nicht“ wird „Lineare Gleichungen“.",
    "Ist die Nachricht diktiert und teils falsch erkannt, rate das gemeinte Thema aus dem Zusammenhang.",
    'Gib einen leeren Titel zurück, wenn die Nachricht kein Thema hat – ein Gruß, "hilf mir mal", ein Test.',
  ].join("\n");
}

/** Der Text neben der Nachricht. Kurz: Die Arbeit steht im Systemprompt. */
export function fachZuordnungUserPrompt({ nachricht }: FachZuordnungContext): string {
  return nachricht;
}
