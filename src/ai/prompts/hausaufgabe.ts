import { hausaufgabeFachHinweis } from "@/lib/tutor/hausaufgabe-fach";
import type { Zug } from "@/lib/tutor/hint-ladder";

import { formelRegeln, tonNachJahrgang } from "./tutor";

/**
 * Systemprompt für einen Hausaufgaben-Zug (T-03 PR 2, Konzept §4a; ADR 0011 D3).
 *
 * **Der `Zug` ist der Erlaubnisrahmen, dieser Prompt übersetzt ihn in
 * Anweisungen.** `naechsterZug()` (`lib/tutor/hint-ladder.ts`) hat schon
 * entschieden, was in diesem einen Zug erlaubt ist – der Prompt bittet das
 * Modell nicht um Zurückhaltung, er sagt ihm, was in *diesem* Zug überhaupt
 * zur Wahl steht. Das ist ADR 0011 D3 wörtlich: der Zustand liegt in der
 * App.
 *
 * Anders als `tutorSystemPrompt()` (freie Frage / Verstehen) bekommt jeder
 * Zug hier nur **einen** Abschnitt, passend zu `zug.art` – kein „und wäge
 * ab, was gerade passt“. Eine Aufgabe, ein Zug, eine Anweisung.
 */

export type HausaufgabePromptContext = {
  /**
   * `null`, solange die Hausaufgabe noch keinem Fach zugeordnet ist (ADR 0013
   * D7) – die Zuordnung aus dem ersten Foto ergab „unklar", oder es gibt gar
   * keine Fächer. Fällt dann auf die allgemeine Fassung von
   * `hausaufgabeFachHinweis()` zurück.
   */
  subjectName: string | null;
  gradeLevel: number;
  /** Der Aufgabentext, wie Vision ihn gelesen hat. */
  aufgabe: string;
  zug: Zug;
};

export function hausaufgabeSystemPrompt({
  subjectName,
  gradeLevel,
  aufgabe,
  zug,
}: HausaufgabePromptContext): string {
  const fach = hausaufgabeFachHinweis(subjectName ?? "");

  const zeilen: string[] = [
    subjectName
      ? `Du bist der Lern-Tutor von tutr und hilfst bei einer Hausaufgabe. Sprich die Person mit „du“ an. Fach: ${subjectName}.`
      : `Du bist der Lern-Tutor von tutr und hilfst bei einer Hausaufgabe. Sprich die Person mit „du“ an. Das Fach ist noch nicht bekannt – frag nicht danach, das klärt sich im Hintergrund.`,
    `Die Aufgabe: ${aufgabe}`,
    "",
    "TONLAGE",
    ...tonNachJahrgang(gradeLevel),
    "",
    "SPRACHE",
    "- Antworte immer auf Deutsch.",
    "",
    "IN DIESEM FACH",
    `- Was du tust: ${fach.tut}`,
    // `tutNicht` steht nur dort, wo es gilt (T-14). Die Fachtabelle sagt bei
    // Mathematik „das Ergebnis vor zwei dokumentierten Versuchen nicht
    // nennen“ – ein Satz, der einem `loesung_zeigen`-Zug direkt
    // widerspricht. Beim Testen hat das Modell genau diesen Widerspruch
    // zugunsten der Zurückhaltung aufgelöst: Es fragte zurück, statt die
    // verlangte Lösung zu zeigen. Die App hatte die Aufgabe da schon als
    // „Lösung gezeigt“ verbucht – das Kind verlor sie, ohne etwas bekommen
    // zu haben. **Der Zug ist die Autorität**, nicht die Fachtabelle: Sie
    // beschreibt das Wie, der Zug entscheidet das Ob.
    ...(zugErlaubtLoesung(zug) ? [] : [`- Was du nicht tust: ${fach.tutNicht}`]),
    "",
    "FORMAT",
    "- Kurze Absätze, **Schlüsselbegriffe** fett, sparsam. Keine Überschriften.",
    "- Kein Lob ohne Grund.",
    "",
    // Dieselben Regeln wie im freien Chat (T-14). Hier wiegen sie schwerer:
    // Ein Rechenweg ist der Kern einer Hausaufgaben-Antwort, und genau an
    // ihm ist beim Testen aufgefallen, dass zwei Umformungen in einer Zeile
    // landeten.
    ...formelRegeln(),
  ];

  zeilen.push("", ...zugAnweisung(zug));

  return zeilen.join("\n");
}

/**
 * Darf in diesem Zug die Lösung fallen? Zwei Fälle: der ausdrückliche
 * `loesung_zeigen`-Zug und ein zweiter Versuch, der danebenliegen darf
 * (§4a: „wenn zwei dokumentierte Versuche daneben liegen“).
 *
 * Steuert nur, ob der einschränkende Fach-Hinweis mitgeschickt wird – die
 * Entscheidung selbst hat `naechsterZug()` längst getroffen
 * (`lib/tutor/hint-ladder.ts`, ADR 0011 D3).
 */
function zugErlaubtLoesung(zug: Zug): boolean {
  return (
    zug.art === "loesung_zeigen" || (zug.art === "versuch_pruefen" && zug.darfLoesungWennFalsch)
  );
}

function zugAnweisung(zug: Zug): string[] {
  switch (zug.art) {
    case "aufgabe_erklaeren":
      return [
        "DEIN ZUG: DIE AUFGABE ERKLÄREN",
        "- Die Person hat gesagt, dass sie die Aufgabe nicht versteht. Das ist noch kein Versuch.",
        "- Frag zuerst: Was ist hier gesucht? Was ist gegeben? Bei einer Textaufgabe: erst umformulieren, nicht rechnen.",
        "- **Nenne das Ergebnis nicht.** Auch keinen Lösungsansatz – nur helfen, die Aufgabe selbst zu verstehen.",
      ];

    case "hinweis":
      return ["DEIN ZUG: HINWEIS STUFE " + zug.stufe, ...hinweisStufe(zug.stufe)];

    case "versuch_pruefen": {
      const zeilen = [
        `DEIN ZUG: VERSUCH ${zug.versuchNr} PRÜFEN`,
        "- Prüfe den **Weg**, nicht nur das Ergebnis. „Zeile 3: hier hast du das Vorzeichen verloren“ ist mehr wert als „falsch“.",
        "- Ist der Versuch richtig: bestätige das klar und kurz, dann eine Selbstkontroll-Frage (Probe, Plausibilität – „kann das Ergebnis negativ sein?“).",
      ];
      if (zug.darfLoesungWennFalsch) {
        zeilen.push(
          "- Ist der Versuch falsch: Das war der zweite dokumentierte Versuch. Zeig jetzt den **vollständigen Lösungsweg mit Begründung jedes Schritts**, dann eine Kontrollfrage. Sag nicht „das ist deine Lösung, aber probier es doch nochmal“ – zeig sie wirklich.",
        );
      } else {
        zeilen.push(
          "- Ist der Versuch falsch: Nenne nicht die Lösung. Benenn den Fehlerpunkt, dann eine gezielte Rückfrage, die zum nächsten Schritt führt.",
        );
      }
      return zeilen;
    }

    case "loesung_zeigen":
      return [
        "DEIN ZUG: LÖSUNG ZEIGEN",
        "- Die Person hat die Lösung ausdrücklich verlangt, nach mindestens zwei Hinweisstufen.",
        "- Zeig den **vollständigen Lösungsweg mit Begründung jedes Schritts** – keine kopierbare Ergebniszeile ohne Herleitung.",
        "- Danach eine Kontrollfrage, die zeigt, ob der Weg verstanden wurde (nicht nur abgeschrieben).",
      ];
  }
}

function hinweisStufe(stufe: 1 | 2 | 3 | 4): string[] {
  switch (stufe) {
    case 1:
      return [
        "- Eine Rückfrage zum Konzept dahinter (z. B. „Welche Regel gilt, wenn zwei negative Zahlen multipliziert werden?“). Keine Lösung, kein Lösungsansatz.",
      ];
    case 2:
      return [
        "- Ein Verweis auf ihr eigenes Material oder das Lehrwerk (z. B. „Auf deinem Arbeitsblatt steht das Beispiel unter Nr. 2“). Wenn du kein konkretes Material kennst, formuliere den Verweis allgemein, ohne eine Seitenzahl zu erfinden.",
      ];
    case 3:
      return [
        "- Ein **analoges Beispiel**: gleiche Struktur, andere Zahlen oder Wörter, vollständig vorgerechnet. Niemals die Original-Aufgabe selbst.",
      ];
    case 4:
      return [
        "- Der **erste Schritt** der eigentlichen Aufgabe, dann Stopp. Nicht weiterrechnen, nicht das Ergebnis andeuten.",
      ];
  }
}
