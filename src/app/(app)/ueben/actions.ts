"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
import type { cardState } from "@/db/schema/vocab";
import { fsrsCardStateSchema } from "@/db/types/fsrs";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";
import { applyReview } from "@/lib/vocab/fsrs";
import {
  classifyMultipleChoice,
  classifyTyped,
  modeForCardState,
  outcomeToGrade,
} from "@/lib/vocab/outcome";
import type { Direction, Outcome } from "@/lib/vocab/session";

/**
 * Datenzugriff für `/ueben` (V-02).
 *
 * Der Actor kommt ausschließlich aus `loginStatus()` – wie überall sonst
 * (siehe `einstellungen/actions.ts`). Wichtiger als sonst: **welche Antwort
 * richtig ist, entscheidet ausschließlich der Server.** `submitAnswer()`
 * bekommt die getippte oder angeklickte Antwort, nie ein fertiges „richtig"/
 * „falsch" – ein manipulierter Aufruf könnte sonst jede Karte als
 * „Kann ich" durchwinken, ohne je etwas zu wissen.
 *
 * RLS-Richtung (ADR 0004 D4): Kind schreibt, Eltern lesen nur. Lesen
 * funktioniert deshalb für beide Rollen, Schreiben nur fürs Kind.
 */

type CardStateValue = (typeof cardState.enumValues)[number];

async function requireActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

async function requireStudentActor(): Promise<Actor | null> {
  const actor = await requireActor();
  return actor?.role === "student" ? actor : null;
}

export type DueOverview = {
  total: number;
  /** Grober Ausblick aus dem FSRS-Zustand, nicht die Session selbst –
   *  die Stapel entstehen erst beim Üben (siehe `session.ts`). */
  wiederholen: number;
  neu: number;
  erneutLernen: number;
};

/** Zahlen für den „Fällig heute"-Block. `null`, wenn nicht angemeldet oder ohne DB (CI-E2E). */
export async function loadDueOverview(): Promise<DueOverview | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const rows = await tx.execute<{ state: CardStateValue; n: string }>(
      sql`select state, count(*)::text as n
          from card
          where due_at <= now()
          group by state`,
    );
    const byState = Object.fromEntries(rows.map((r) => [r.state, Number(r.n)]));
    return {
      total: rows.reduce((sum, r) => sum + Number(r.n), 0),
      wiederholen: byState.wiederholen ?? 0,
      neu: (byState.neu ?? 0) + (byState.lernen ?? 0),
      erneutLernen: byState.erneut_lernen ?? 0,
    };
  });
}

export type SessionCardContent = {
  cardId: string;
  vocabItemId: string;
  direction: Direction;
  mode: "mc" | "tippen";
  /** Die erwartete Antwort steht mit im Ladeergebnis – das Kind soll sie ja
   *  sehen können (als MC-Option), nur *bewertet* wird sie serverseitig neu. */
  term: string;
  translation: string;
};

/**
 * Fällige Karten für eine Session, inhaltlich angereichert. `direction`
 * filtert nach ADR 0007 D5 – `null` heißt gemischt (die Voreinstellung).
 */
export async function loadSessionCards(
  direction: Direction | null,
): Promise<SessionCardContent[] | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  type Row = {
    card_id: string;
    vocab_item_id: string;
    direction: Direction;
    state: CardStateValue;
    term: string;
    translation: string;
  };

  return withActor(actor, async (tx) => {
    const rows = await tx.execute<Row>(
      direction
        ? sql`select c.id as card_id, c.vocab_item_id, c.direction, c.state, vi.term, vi.translation
              from card c join vocab_item vi on vi.id = c.vocab_item_id
              where c.due_at <= now() and c.direction = ${direction}
              order by c.due_at`
        : sql`select c.id as card_id, c.vocab_item_id, c.direction, c.state, vi.term, vi.translation
              from card c join vocab_item vi on vi.id = c.vocab_item_id
              where c.due_at <= now()
              order by c.due_at`,
    );
    return rows.map((r) => ({
      cardId: r.card_id,
      vocabItemId: r.vocab_item_id,
      direction: r.direction,
      mode: modeForCardState(r.state),
      term: r.term,
      translation: r.translation,
    }));
  });
}

export type AnswerResult = { outcome: Outcome };

/**
 * Eine Antwort einreichen. `given` ist die getippte oder angeklickte
 * Beschriftung – bei Multiple Choice ein exakter Vergleich (die Optionen
 * standen ja da), beim Tippen die Toleranzprüfung aus `answer.ts`.
 *
 * Holt `fsrs_state` frisch aus der Datenbank statt vom Client entgegen-
 * zunehmen: Der FSRS-Zustand ist nur dort maßgeblich, nie im Browser
 * zwischengespeichert weiterverarbeitet.
 */
export async function submitAnswer(input: {
  cardId: string;
  mode: "mc" | "tippen";
  given: string;
  responseMs: number;
}): Promise<AnswerResult | null> {
  const actor = await requireStudentActor();
  if (!actor || actor.role !== "student") return null;

  type CardRow = { fsrs_state: unknown; direction: Direction; vocab_item_id: string };
  type VocabRow = { term: string; translation: string };

  const result = await withActor(actor, async (tx) => {
    const [card] = await tx.execute<CardRow>(
      sql`select fsrs_state, direction, vocab_item_id from card where id = ${input.cardId}`,
    );
    if (!card) return null;

    const [vocab] = await tx.execute<VocabRow>(
      sql`select term, translation from vocab_item where id = ${card.vocab_item_id}`,
    );
    if (!vocab) return null;

    // Karte zeigt term→translation oder translation→term, je nach Richtung.
    const expected = card.direction === "vorwaerts" ? vocab.translation : vocab.term;

    const outcome =
      input.mode === "mc"
        ? classifyMultipleChoice(
            input.given.trim().toLowerCase() === expected.trim().toLowerCase(),
            input.responseMs,
          )
        : classifyTyped(expected, input.given).outcome;

    const current = fsrsCardStateSchema.parse(card.fsrs_state);
    const applied = applyReview(current, outcomeToGrade(outcome));

    await tx.execute(
      sql`update card set fsrs_state = ${JSON.stringify(applied.fsrsState)}::jsonb,
            due_at = ${applied.dueAt.toISOString()}, state = ${applied.state}
          where id = ${input.cardId}`,
    );
    await tx.execute(
      sql`insert into review (student_id, card_id, rating, response_ms)
          values (${actor.studentId}, ${input.cardId}, ${applied.rating}, ${input.responseMs})`,
    );

    return { outcome };
  });

  revalidatePath("/ueben");
  return result;
}
