/**
 * Prompt für die Fach-Zuordnung (T-13, ADR 0013 D2). System- und Nutzerteil
 * getrennt (`src/ai/prompts/README.md`).
 *
 * Läuft **einmal**, bei der ersten Nachricht eines neuen Gesprächs ohne
 * mitgeschicktes Fach – Haiku (CLAUDE.md: „Haiku für Klassifikation"), nicht
 * das Modell, das die Antwort schreibt: Die eigentliche Antwort soll nicht
 * selbst entscheiden, wo sie einsortiert wird (ADR 0011 D3, der Zustand
 * gehört der App).
 */

export type FachZuordnungContext = {
  /** Die Fächer des Kindes im aktuellen Schuljahr – die einzige erlaubte Auswahl neben „unklar". */
  faecher: readonly string[];
  /** Die erste Nachricht des Kindes, unverändert. */
  nachricht: string;
};

export function fachZuordnungSystemPrompt({ faecher }: FachZuordnungContext): string {
  return [
    "Du ordnest die erste Nachricht in einem Lern-Tutor einem Schulfach zu.",
    `Die möglichen Fächer: ${faecher.join(", ")}.`,
    "",
    'Gib genau einen dieser Fachnamen zurück – buchstabengetreu, wie oben geschrieben – oder "unklar".',
    'Gib "unklar", wenn die Nachricht zu keinem der Fächer eindeutig passt, zu mehreren passen könnte, oder allgemeiner Natur ist (ein Gruß, eine Frage zur App selbst, Small Talk).',
    "Rate nicht. Ein falsch zugeordnetes Fach ist schlechter als gar keins.",
  ].join("\n");
}

/** Der Text neben der Nachricht. Kurz: Die Arbeit steht im Systemprompt. */
export function fachZuordnungUserPrompt({ nachricht }: FachZuordnungContext): string {
  return nachricht;
}
