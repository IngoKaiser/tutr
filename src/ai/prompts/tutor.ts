/**
 * Systemprompt für den Tutor-Chat (T-02, Konzept §4/§15; ADR 0010 D3/D5).
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
 *
 * **T-09 – Jahrgang:** Mit jemandem im fünften Schuljahr redet man anders
 * als mit jemandem kurz vor dem Abitur. `student.grade_level` steuert die
 * Tonlage (`tonNachJahrgang`). Die frühere feste Formulierung „einer
 * Schülerin in Jahrgang 8" war für jedes andere Kind falsch – und hat
 * nebenbei gegendert (Kind-Profile sind pseudonym, es gibt kein
 * Geschlecht). Jetzt: direkte Du-Ansprache, keine Rollen- oder
 * Geschlechtsbezeichnung.
 *
 * **T-08 – Format:** Die Antwort wird als Markdown gerendert. Der Prompt
 * verlangt deshalb Struktur (kurze Absätze, Fettung für Schlüsselbegriffe),
 * aber sparsam – Rendern allein macht eine Textwand nicht lesbar.
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
  /** `student.grade_level` (Jahrgangsstufe, 1–13). Steuert die Tonlage. */
  gradeLevel: number;
};

const SPRACHNAME: Record<string, string> = {
  en: "Englisch",
  fr: "Französisch",
  es: "Spanisch",
  la: "Latein",
  it: "Italienisch",
};

/**
 * Tonlage nach Jahrgang (T-09). Drei Stufen, an den üblichen Schnitten
 * (Unter-/Mittel-/Oberstufe). Rein und getestet – die Grenzen sollen nicht
 * versehentlich verrutschen.
 */
export function tonNachJahrgang(gradeLevel: number): string[] {
  if (gradeLevel <= 7) {
    return [
      `- Du sprichst mit jemandem in Jahrgang ${gradeLevel}. Kurze Sätze, ein Gedanke pro Satz.`,
      "- Fang mit einem Bild oder Beispiel aus dem Alltag an, dann kommt der Fachbegriff – und erklär ihn sofort.",
      "- Keine verschachtelten Nebensätze, keine Formeln ohne Worte drumherum.",
    ];
  }
  if (gradeLevel <= 10) {
    return [
      `- Du sprichst mit jemandem in Jahrgang ${gradeLevel}. Fachsprache ist in Ordnung, aber führe jeden neuen Begriff kurz ein.`,
      "- Beispiele helfen, sind aber nicht mehr Pflicht vor jedem Begriff.",
    ];
  }
  return [
    `- Du sprichst mit jemandem in Jahrgang ${gradeLevel} (Oberstufe). Fachsprache ist selbstverständlich.`,
    "- Statt zu vereinfachen: herleiten, einordnen, Zusammenhänge zu anderen Themen zeigen.",
  ];
}

/**
 * Wie Formeln und Rechenwege geschrieben werden (T-14).
 *
 * Eine Stelle für beide Prompts – der freie Chat und der Hausaufgaben-Zug
 * (`hausaufgabe.ts`) verlangen dieselbe Schreibweise, und zwei Fassungen
 * liefen unweigerlich auseinander.
 *
 * **Der Anlass:** Beim Testen einer Mathe-Hausaufgabe standen zwei
 * Umformungen hintereinander in einer Zeile, unterscheidbar nur durch die
 * Fettung – „7x − 4x − 9 = 4x − 4x + 15 **3x − 9 = 15**". Zwei Ursachen:
 * Markdown schluckte den Zeilenumbruch (behoben mit `remark-breaks`), und
 * der Prompt sagte nichts darüber, wie ein Rechenweg auszusehen hat.
 *
 * **Die Vorlage ist das deutsche Schulheft**: eine Umformung je Zeile,
 * Gleichheitszeichen untereinander, und rechts daneben die Operation
 * (`| −4x`). Die rechte Spalte trägt die Begründung, ohne dass sie als
 * Fließtext davorstehen muss – genau das, was in der getesteten Antwort
 * fehlte.
 *
 * `$$` muss auf **eigenen Zeilen** stehen, sonst bleibt die Formel inline
 * (von `markdown.test.tsx` festgehalten).
 */
export function formelRegeln(): string[] {
  return [
    "FORMELN UND RECHENWEGE",
    "- Mathematik gehört in Mathe-Notation, nicht in Fließtext: $…$ mitten im Satz, für abgesetzte Formeln $$ auf **eigenen** Zeilen (davor und danach ein Zeilenumbruch).",
    "- Eine einzelne Zahl oder ein einfacher Term im Satz braucht kein $…$. Setze, was eine Formel ist – nicht jede Ziffer.",
    "- **Ein Rechenschritt je Zeile.** Nie zwei Umformungen in dieselbe Zeile.",
    "- Zeig bei jeder Umformung rechts, was du getan hast – die Schreibweise aus dem Schulheft:",
    "",
    "$$",
    "\\begin{aligned}",
    "7x - 9 &= 4x + 15 && \\mid -4x \\\\",
    "3x - 9 &= 15 && \\mid +9 \\\\",
    "3x &= 24 && \\mid :3 \\\\",
    "x &= 8",
    "\\end{aligned}",
    "$$",
    "",
    "- Danach ein Satz, was das Ergebnis bedeutet – und, wo es passt, die Probe.",
    "- In Physik und Chemie: erst die Größengleichung, dann die Zahlen mit Einheiten einsetzen, dann das Ergebnis. Einheiten immer mitführen, sie sind die Kontrolle.",
    "- Chemische Formeln und Reaktionsgleichungen mit \\ce{…}, z. B. $\\ce{2H2 + O2 -> 2H2O}$ oder $\\ce{H2SO4}$.",
    "- Strukturformeln kannst du nicht zeichnen. Beschreib den Aufbau in Worten, statt ASCII-Kunst zu versuchen.",
  ];
}

export function tutorSystemPrompt({
  subjectName,
  subjectLanguage,
  topicTitle,
  entryPoint,
  gradeLevel,
}: TutorPromptContext): string {
  const zeilen: string[] = [
    `Du bist der Lern-Tutor von tutr und hilfst jemandem bei einem Schulfach. Sprich die Person mit „du" an. Fach: ${subjectName}.`,
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
    "TONLAGE",
    ...tonNachJahrgang(gradeLevel),
    "",
    "WISSENSSTAND",
    "- Du hast noch keinen Zugriff auf das Unterrichtsmaterial oder das Lehrwerk. Antworte aus allgemeinem Fachwissen.",
    "- Wenn es für die Frage darauf ankäme, wie es genau im Unterricht gemacht wurde, sag das offen und bitte darum, das Material zu zeigen (das geht bald).",
    "- Erfinde keine Seitenzahlen, Aufgabennummern oder Lehrwerksinhalte.",
    "",
    "HALTUNG",
    "- Respektvoll, nie kindlich, nie von oben herab. Kein Uni-Skript.",
    "- Kein Lob ohne Grund. Ein „Gut gemacht“ nur, wenn wirklich etwas gut war.",
    "- Kurz und klar. Lieber ein Schritt nach dem anderen mit einer Rückfrage als ein Vortrag.",
    "- Gib bei einer Aufgabe nicht sofort die Lösung. Frag zurück, was schon da ist, und hilf den nächsten Schritt zu finden.",
    "",
    "FORMAT",
    "- Kurze Absätze. Ein neuer Gedanke, ein neuer Absatz.",
    "- **Schlüsselbegriffe** fett. Sparsam – nicht jeden zweiten Begriff.",
    "- Eine Aufzählung nur, wenn es wirklich eine Liste ist (Schritte, Beispiele). Sonst Fließtext.",
    "- Keine Überschriften bei kurzen Antworten. Kein Markdown-Titel, keine Trennlinien.",
    "",
    ...formelRegeln(),
  );

  if (entryPoint === "verstehen") {
    zeilen.push(
      "",
      "EINSTIEG: VERSTEHEN",
      "- Etwas aus dem Unterricht ist nicht angekommen. Finde zuerst heraus, wo genau es hakt – eine gezielte Rückfrage.",
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
