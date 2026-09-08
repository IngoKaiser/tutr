import { Rating, type Grade } from "ts-fsrs";

import type { cardState } from "@/db/schema/vocab";

import { evaluateAnswer, type AnswerQuality } from "./answer";
import type { Outcome } from "./session";

/**
 * Vom Modus zum Stapel (V-02, §6 M4).
 *
 * Zwei Wege zum selben Ergebnis, je nachdem, wie geprüft wird: Multiple
 * Choice hat nur richtig/falsch, braucht also die Zeit als drittes Signal
 * für „Übe ich". Tippen hat sein drittes Signal schon in der Antwort selbst
 * (`fast` aus `answer.ts`) – keine Uhr nötig, und die Zeit hinge ohnehin
 * stärker an Wortlänge und Tippgeschwindigkeit als am Erinnern.
 *
 * Beide Zeiten sind **nicht sichtbar** (CLAUDE.md §15: keine
 * Dringlichkeitselemente) – sie sortieren die Antwort im Nachhinein ein,
 * mehr nicht.
 */

/**
 * Schätzwert, keine Messung: In der App noch nicht real genutzt worden.
 * Nach echter Nutzung nachjustieren (siehe docs/PLAN.md V-02).
 */
export const MULTIPLE_CHOICE_FAST_MS = 6_000;

/**
 * Grundzeit plus Zeit je Zeichen der erwarteten Antwort, statt einer festen
 * Schwelle: "aller" (5 Zeichen) und "se brosser les dents" (20 Zeichen)
 * dürfen nicht dieselbe Grenze haben – sonst bestraft die Uhr lange Wörter,
 * und weil eine Karte die Session nur über *Kann ich* verlässt, könnte eine
 * Session mit langen Vokabeln kaum enden. Auch hier: Schätzwerte.
 */
export function typingBudgetMs(expectedLength: number): number {
  return 4_000 + expectedLength * 400;
}

export function classifyMultipleChoice(correct: boolean, responseMs: number): Outcome {
  if (!correct) return "nochmal";
  return responseMs <= MULTIPLE_CHOICE_FAST_MS ? "kann_ich" : "uebe_ich";
}

const QUALITY_TO_OUTCOME: Record<AnswerQuality, Outcome> = {
  richtig: "kann_ich",
  fast: "uebe_ich",
  falsch: "nochmal",
};

export function classifyTyped(
  expected: string,
  given: string,
): { outcome: Outcome; quality: AnswerQuality } {
  const quality = evaluateAnswer(expected, given);
  return { outcome: QUALITY_TO_OUTCOME[quality], quality };
}

/**
 * `Easy` (die vierte FSRS-Bewertung) bleibt ungenutzt – dafür gibt es kein
 * Signal in der Oberfläche, und eines zu erfinden wäre geraten statt
 * gemessen.
 */
export function outcomeToGrade(outcome: Outcome): Grade {
  switch (outcome) {
    case "kann_ich":
      return Rating.Good;
    case "uebe_ich":
      return Rating.Hard;
    case "nochmal":
      return Rating.Again;
  }
}

type CardStateValue = (typeof cardState.enumValues)[number];

/**
 * Multiple Choice, solange eine Karte noch nicht gefestigt ist; Tippen erst
 * ab `wiederholen`. Eine frische Karte ist nach der ersten Antwort schon
 * `lernen` (auch nach einer falschen – gegen `ts-fsrs` geprüft, nicht
 * angenommen), und nach einem Fehler fällt eine gefestigte Karte auf
 * `erneut_lernen` zurück. Beide bekommen wieder Multiple Choice: Tippen ist
 * der Nachweis, nicht die Übung, mit der eine Karte neu beginnt.
 */
export function modeForCardState(state: CardStateValue): "mc" | "tippen" {
  return state === "wiederholen" ? "tippen" : "mc";
}
