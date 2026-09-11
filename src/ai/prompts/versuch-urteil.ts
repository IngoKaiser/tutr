/**
 * Prompt für die Urteils-Klassifizierung eines Hausaufgaben-Versuchs (T-03
 * PR 2, §4a). System- und Nutzerteil getrennt (`src/ai/prompts/README.md`).
 *
 * **Liest nur, was der Tutor selbst schon geschrieben hat** – kein neuer
 * Blick auf den Rechenweg des Kindes, keine zweite Bewertung. Der Tutor hat
 * die Aufgabe, den Versuch und (falls vorhanden) das Foto bereits gesehen
 * und in seiner Antwort beurteilt („Zeile 3: hier hast du das Vorzeichen
 * verloren" o. Ä.); dieser Aufruf destilliert daraus nur das Ergebnis in
 * ein `enum`. Deshalb reicht Haiku (CLAUDE.md: „Haiku für Klassifikation") –
 * die eigentliche fachliche Bewertung ist mit Sonnet schon gelaufen.
 */

export type VersuchUrteilContext = {
  /** Der Aufgabentext, damit „richtig" sich auf dieselbe Aufgabe bezieht. */
  aufgabe: string;
  /** Die vollständige Tutor-Antwort auf den Versuch. */
  tutorAntwort: string;
};

export function versuchUrteilSystemPrompt(): string {
  return [
    "Du liest die Antwort eines Lern-Tutors auf den Versuch einer Schülerin oder eines Schülers an einer Hausaufgabe.",
    "Deine einzige Aufgabe: einordnen, was die Tutor-Antwort selbst über den Versuch aussagt.",
    "",
    'Gib "richtig", wenn die Tutor-Antwort den Versuch als richtig bestätigt (Ergebnis und Weg).',
    'Gib "falsch_loesung_gezeigt", wenn die Tutor-Antwort den Versuch als falsch einordnet UND zusätzlich den vollständigen Lösungsweg mit Begründung zeigt.',
    'Gib "falsch" bei jedem anderen falschen oder teilweise falschen Versuch – auch wenn die Antwort einen Hinweis oder eine Rückfrage enthält, solange sie nicht die vollständige Lösung zeigt.',
    "",
    "Rate nicht anhand der Aufgabe selbst – urteile ausschließlich danach, was die Tutor-Antwort sagt.",
  ].join("\n");
}

export function versuchUrteilUserPrompt({ aufgabe, tutorAntwort }: VersuchUrteilContext): string {
  return [`Aufgabe: ${aufgabe}`, "", "Tutor-Antwort auf den Versuch:", tutorAntwort].join("\n");
}
