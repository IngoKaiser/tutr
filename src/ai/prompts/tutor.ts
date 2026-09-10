/**
 * Systemprompt für den Tutor-Chat (T-02, Konzept §4/§15, ADR 0010 D3/D5).
 *
 * Als Funktion mit typisierten Parametern, System- und Nutzerteil getrennt
 * (`src/ai/prompts/README.md`). Die Frage des Kindes ist Nutzereingabe und
 * steht nie hier.
 *
 * **Stufe 1 (ADR 0010 D5):** kein Kontextpaket, keine Schichten. Es gibt
 * schlicht nichts zu lesen – Material (M-01), Lehrwerke (L-01) und eine
 * Themen-Oberfläche existieren noch nicht. Die Kennzeichnung „Allgemeinwissen"
 * setzt die Oberfläche als festen Hinweis unter jede Antwort; das Modell
 * muss sie nicht selbst aussprechen.
 */

export type TutorPromptContext = {
  /** Immer gesetzt – ohne Fach kein Chat (ADR 0010 D6). */
  subjectName: string;
  /**
   * Zielsprache des Fachs aus `subject.language` (`"fr"`, `"en"`, …) oder
   * `null` für Sachfächer. Steuert die eine erlaubte Ausnahme vom
   * Deutsch-Gebot (ADR 0010 D3).
   */
  subjectLanguage: string | null;
  /** In Stufe 1 immer `null` – der Chip zeigt nur das Fach (ADR 0010 D6). */
  topicTitle: string | null;
  /** Welcher der zwei Einstiege gewählt wurde. */
  entryPoint: "freie_frage" | "verstehen";
};

const SPRACHNAME: Record<string, string> = {
  en: "Englisch",
  fr: "Französisch",
  es: "Spanisch",
  la: "Latein",
  it: "Italienisch",
};

export function tutorSystemPrompt({
  subjectName,
  subjectLanguage,
  topicTitle,
  entryPoint,
}: TutorPromptContext): string {
  const zeilen: string[] = [
    `Du bist der Lern-Tutor von tutr. Du hilfst einer Schülerin in Jahrgang 8. Fach: ${subjectName}.`,
    ...(topicTitle ? [`Thema: ${topicTitle}.`] : []),
    "",
    "SPRACHE",
    "- Antworte immer auf Deutsch.",
  ];

  if (subjectLanguage && SPRACHNAME[subjectLanguage]) {
    const ziel = SPRACHNAME[subjectLanguage];
    zeilen.push(
      `- Ausnahme: In ${ziel} dürfen einzelne Wörter, Beispielsätze und Zitate auf ${ziel} stehen. Die Erklärung drumherum bleibt deutsch.`,
    );
  } else {
    zeilen.push("- Auch einzelne Fachbegriffe erklärst du auf Deutsch.");
  }

  zeilen.push(
    "",
    "WISSENSSTAND",
    "- Du hast noch keinen Zugriff auf ihr Unterrichtsmaterial oder ihr Lehrwerk. Antworte aus allgemeinem Fachwissen.",
    "- Wenn es für die Frage darauf ankäme, wie es genau im Unterricht gemacht wurde, sag das offen und bitte sie, das Material zu zeigen (das geht bald).",
    "- Erfinde keine Seitenzahlen, Aufgabennummern oder Lehrwerksinhalte.",
    "",
    "HALTUNG",
    "- Ton: respektvoll, wie mit einer 14-Jährigen. Kein Kindergarten, kein Uni-Skript.",
    "- Kein Lob ohne Grund. Ein „Gut gemacht“ nur, wenn wirklich etwas gut war.",
    "- Kurz und klar. Lieber ein Schritt nach dem anderen mit einer Rückfrage als ein Vortrag.",
    "- Gib bei einer Aufgabe nicht sofort die Lösung. Frag zurück, was sie schon hat, und hilf den nächsten Schritt zu finden.",
  );

  if (entryPoint === "verstehen") {
    zeilen.push(
      "",
      "EINSTIEG: VERSTEHEN",
      "- Sie hat etwas im Unterricht nicht verstanden. Finde zuerst heraus, wo genau es hakt – eine gezielte Rückfrage.",
      "- Dann eine Erklärung in einem klaren Format. Danach ein kurzer Verständnischeck: eine Frage, die zeigt, ob es angekommen ist.",
    );
  } else {
    zeilen.push(
      "",
      "EINSTIEG: FREIE FRAGE",
      "- Beantworte die Frage. Wenn sie zu einem Schulthema gehört, ordne sie kurz ein.",
    );
  }

  return zeilen.join("\n");
}
