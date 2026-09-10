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
  /** Grober Ausblick aus dem FSRS-Zustand, nicht die Session selbst –
   *  die Stapel entstehen erst beim Üben (siehe `session.ts`). */
  wiederholen: number;
  neu: number;
  erneutLernen: number;
};

export type DueBySubject = {
  subjectId: string;
  subjectName: string;
  /** ISO-639-1 der Zielsprache, `null` bei einem Frage-Antwort-Fach (V-06a). */
  language: string | null;
  total: number;
} & DueOverview;

/**
 * Fällige Vokabeln je Fach (V-06, ADR 0008 D3; gezählt seit V-06a) – **nie**
 * eine Zahl über alles. Niemand übt Französisch- und Spanischvokabeln in
 * derselben Runde; eine Übungssession läuft immer in genau einem Fach.
 *
 * **Gezählt wird die Vokabel, nicht die Karte** (V-06a). Eine Vokabel hat
 * zwei Karten (vorwärts/rückwärts), aber „Gemischt" fragt sie je Runde nur
 * einmal – die frühere Zählung über `card` zeigte deshalb das Doppelte
 * („166 fällig" statt 83). `distinct on` wählt je Vokabel die früher fällige
 * Karte; deren Zustand steht dann für die Vokabel im Stapel. `coalesce(…,
 * c.id)` hält Lernziel-Karten (M-03, `vocab_item_id` null) auseinander,
 * statt sie alle zu einer Zeile zu verschmelzen.
 *
 * Das Fach kommt für beide Kartenquellen aus derselben Herkunft: Bei
 * Vokabelkarten über `vocab_item.subject_id` (n:1, V-05), bei Lernziel-Karten
 * über `learning_objective → topic → subject_id` – nie eine eigene Spalte auf
 * `card` (ADR 0008 D1). `card_exactly_one_source` garantiert, dass nie beide
 * Joins gleichzeitig treffen.
 *
 * `null`, wenn nicht angemeldet oder ohne DB (CI-E2E). Ein leeres Array
 * heißt: nichts fällig, kein Fach zeigt einen Block.
 */
export async function loadDueBySubject(): Promise<DueBySubject[] | null> {
  const actor = await requireActor();
  if (!actor) return null;

  type Row = {
    subject_id: string;
    subject_name: string;
    language: string | null;
    state: CardStateValue;
    n: string;
  };

  return withActor(actor, async (tx) => {
    const rows = await tx.execute<Row>(
      sql`select s.id as subject_id, s.name as subject_name, s.language, gewaehlt.state,
                 count(*)::text as n
          from (
            select distinct on (coalesce(vi.subject_id, t.subject_id), coalesce(c.vocab_item_id, c.id))
              coalesce(vi.subject_id, t.subject_id) as subj_id,
              c.state
            from card c
            left join vocab_item vi on vi.id = c.vocab_item_id
            left join learning_objective lo on lo.id = c.objective_id
            left join topic t on t.id = lo.topic_id
            where c.due_at <= now()
            order by coalesce(vi.subject_id, t.subject_id),
                     coalesce(c.vocab_item_id, c.id),
                     c.due_at asc,
                     c.direction asc nulls last
          ) gewaehlt
          join subject s on s.id = gewaehlt.subj_id
          group by s.id, s.name, s.language, gewaehlt.state`,
    );

    const bySubject = new Map<string, DueBySubject>();
    for (const row of rows) {
      const entry = bySubject.get(row.subject_id) ?? {
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        language: row.language,
        total: 0,
        wiederholen: 0,
        neu: 0,
        erneutLernen: 0,
      };
      const n = Number(row.n);
      entry.total += n;
      if (row.state === "wiederholen") entry.wiederholen += n;
      else if (row.state === "neu" || row.state === "lernen") entry.neu += n;
      else if (row.state === "erneut_lernen") entry.erneutLernen += n;
      bySubject.set(row.subject_id, entry);
    }
    return [...bySubject.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName, "de"));
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
 * Fällige Karten für eine Session, inhaltlich angereichert. Läuft immer in
 * genau einem Fach (V-06, ADR 0008 D3) – `subjectId` ist deshalb Pflicht,
 * nicht optional wie `direction`. Der Vorrat ist dadurch von selbst
 * einsprachig: `buildMultipleChoiceOptions()` zieht die Falschantworten aus
 * genau diesen Karten, eine eigene Fach-Regel dort ist nicht nötig.
 *
 * `direction` filtert zusätzlich nach ADR 0007 D5 – `null` heißt gemischt
 * (die Voreinstellung). **Gemischt liefert je Vokabel genau eine Karte**
 * (V-06a): die früher fällige, bei gleichem `due_at` die vorwärts-Karte.
 * Sonst käme jede Vokabel zweimal in derselben Runde, und die angezeigte
 * Zahl stimmte nicht mehr mit der Zahl der Fragen überein.
 *
 * `c.direction asc` heißt hier **vorwärts zuerst**: `vocab_direction` ist ein
 * `pgEnum`, Postgres sortiert es nach Deklarationsreihenfolge
 * (`["vorwaerts", "rueckwaerts"]`), nicht alphabetisch. Nicht auf `desc`
 * „korrigieren" – das drehte die Vorzugsrichtung um.
 */
export async function loadSessionCards(
  subjectId: string,
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
              where c.due_at <= now() and c.direction = ${direction} and vi.subject_id = ${subjectId}
              order by c.due_at`
        : sql`select card_id, vocab_item_id, direction, state, term, translation from (
                select distinct on (c.vocab_item_id)
                  c.id as card_id, c.vocab_item_id, c.direction, c.state,
                  vi.term, vi.translation, c.due_at
                from card c join vocab_item vi on vi.id = c.vocab_item_id
                where c.due_at <= now() and vi.subject_id = ${subjectId}
                order by c.vocab_item_id, c.due_at asc, c.direction asc
              ) gewaehlt
              order by due_at`,
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

  return result;
}

/**
 * Die Fällig-Zahlen der Übersicht auffrischen (V-02-Nachtrag). Läuft
 * **einmal beim Verlassen der Session**, nicht nach jeder Antwort.
 *
 * Vorher stand `revalidatePath("/ueben")` am Ende von `submitAnswer()` –
 * bei jeder einzelnen Antwort. `loadDueBySubject()` ist aber eine
 * Aggregation über alle Karten, und Next rendert die Seite dafür komplett
 * neu. Der „Weiter"-Knopf blieb so lange deaktiviert, bis das durch war:
 * spürbare Verzögerung zwischen Antwort und Rückmeldung, obwohl
 * `submitAnswer()` selbst nur eine Zeile schreibt. Gefunden beim Testen.
 *
 * Während der Session selbst braucht es das nicht – der Fortschritt in der
 * Kopfzeile kommt aus dem clientseitigen `SessionState`, nicht aus dieser
 * Zahl (siehe Kommentar in `practice-session.tsx`). Erst die Übersicht, zu
 * der man nach „Geschafft" oder einem Ausstieg zurückkehrt, muss wieder
 * stimmen.
 */
export async function refreshDueOverview(): Promise<void> {
  revalidatePath("/ueben");
}
