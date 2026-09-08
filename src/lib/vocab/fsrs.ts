import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

import type { cardState, reviewRating } from "@/db/schema/vocab";
import { fsrsCardStateSchema, type FsrsCardState } from "@/db/types/fsrs";

/**
 * Übersetzung zwischen `ts-fsrs` und den Spalten aus `vocab.ts` (V-01).
 *
 * Einzige Stelle im Projekt, die `card.fsrs_state`, `card.due_at` und
 * `card.state` schreibt – alle drei zusammen, nie einzeln, sonst laufen
 * Spiegel und Quelle auseinander (siehe Kommentar in `db/types/fsrs.ts`).
 * `card_state`/`review_rating` sind deutsche ASCII-Werte (ADR 0006 D10),
 * `ts-fsrs` kennt nur seine eigenen numerischen Enums – die Übersetzung
 * steckt ausschließlich hier, nicht verstreut in Server Actions.
 */

type CardStateValue = (typeof cardState.enumValues)[number];
type ReviewRatingValue = (typeof reviewRating.enumValues)[number];

const STATE_TO_DB: Record<State, CardStateValue> = {
  [State.New]: "neu",
  [State.Learning]: "lernen",
  [State.Review]: "wiederholen",
  [State.Relearning]: "erneut_lernen",
};

const RATING_TO_DB: Record<Grade, ReviewRatingValue> = {
  [Rating.Again]: "nochmal",
  [Rating.Hard]: "schwierig",
  [Rating.Good]: "gut",
  [Rating.Easy]: "leicht",
};

const DB_TO_GRADE: Record<ReviewRatingValue, Grade> = {
  nochmal: Rating.Again,
  schwierig: Rating.Hard,
  gut: Rating.Good,
  leicht: Rating.Easy,
};

/** Für die UI (V-02): welche Bewertung meint dieser gespeicherte Wert? */
export function dbRatingToGrade(rating: ReviewRatingValue): Grade {
  return DB_TO_GRADE[rating];
}

export type CardColumns = { fsrsState: FsrsCardState; dueAt: Date; state: CardStateValue };

function toColumns(card: Card): CardColumns {
  return {
    fsrsState: fsrsCardStateSchema.parse(card),
    dueAt: card.due,
    state: STATE_TO_DB[card.state],
  };
}

/** Neue Karte, frisch aus einer Vokabel oder einem Lernziel entstanden. */
export function newCardColumns(now: Date = new Date()): CardColumns {
  return toColumns(createEmptyCard(now));
}

const scheduler = fsrs();

/**
 * Eine Bewertung anwenden. Nimmt den aktuellen `fsrs_state`-Wert aus der
 * Datenbank (nicht `dueAt`/`state` – die sind nur Spiegel) und gibt die drei
 * Spalten zurück, die `card` danach bekommt, plus die Bewertung für die neue
 * `review`-Zeile.
 */
export function applyReview(
  current: FsrsCardState,
  grade: Grade,
  now: Date = new Date(),
): CardColumns & { rating: ReviewRatingValue } {
  const { card } = scheduler.next(current, now, grade);
  return { ...toColumns(card), rating: RATING_TO_DB[grade] };
}
