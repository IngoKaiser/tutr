"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
import type { cardState } from "@/db/schema/vocab";
import { fsrsCardStateSchema } from "@/db/types/fsrs";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";
import { applyReview } from "@/lib/vocab/fsrs";
import { practiceReadySql } from "@/lib/vocab/practice-filter";
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

export type MasteryOverview = {
  /** Vokabeln des Fachs, bei denen **keine** Richtung je eine Antwort gesehen
   *  hat (jede Karte noch im Zustand `neu`). */
  neu: number;
  /** Vokabeln, an denen gearbeitet wird: mindestens eine Richtung angefangen,
   *  aber noch nicht **jede** Richtung gefestigt. Hier zählt jeder Anfang –
   *  sonst bewegte sich die Zahl praktisch nie (V-08). */
  amUeben: number;
  /** Vokabeln, bei denen **jede** Richtung im FSRS-Zustand `wiederholen` ist. */
  sitzt: number;
};

export type DueBySubject = {
  subjectId: string;
  subjectName: string;
  /** ISO-639-1 der Zielsprache, `null` bei einem Frage-Antwort-Fach (V-06a). */
  language: string | null;
  /** Fällige Vokabeln **heute** – die Handlungszahl. Treibt „X fällig" und ob
   *  der Block überhaupt erscheint. */
  total: number;
} & MasteryOverview;

/**
 * Fällige Vokabeln je Fach plus Lernstand über den ganzen Wortschatz (V-06,
 * ADR 0008 D3; Lernstand seit V-08) – **nie** eine Zahl über alle Fächer.
 * Niemand übt Französisch- und Spanischvokabeln in derselben Runde; eine
 * Übungssession läuft immer in genau einem Fach.
 *
 * **Gezählt wird die Vokabel, nicht die Karte** (V-06a). Eine Vokabel hat
 * zwei Karten (vorwärts/rückwärts). Der CTE fasst sie über zwei Booleans
 * zusammen: `ganz_neu` (jede Karte noch `neu`) und `ganz_fest` (jede Karte
 * `wiederholen`). „Neu" und „Sitzt" verlangen also **alle** Richtungen,
 * „Am Üben" ist alles dazwischen – schon eine angefangene Richtung reicht.
 * `coalesce(…, c.id)` hält Lernziel-Karten (M-03, `vocab_item_id` null)
 * auseinander, statt sie alle zu einer Zeile zu verschmelzen.
 *
 * `total` zählt weiter nur, was **heute fällig** ist (`bool_or(due_at <=
 * now())`) – der Lernstand dagegen über den gesamten Wortschatz, sonst
 * stünde in „Sitzt" fast immer 0: Eine gefestigte Karte ist per Definition
 * erst in Tagen wieder fällig und fiele aus einer nur-fällig-Zählung heraus.
 * Genau das war der Fund aus der Praxis (V-08): sichtbarer Fortschritt fehlte.
 *
 * Das Fach kommt für beide Kartenquellen aus derselben Herkunft: Bei
 * Vokabelkarten über `vocab_item.subject_id` (n:1, V-05), bei Lernziel-Karten
 * über `learning_objective → topic → subject_id` – nie eine eigene Spalte auf
 * `card` (ADR 0008 D1). `card_exactly_one_source` garantiert, dass nie beide
 * Joins gleichzeitig treffen.
 *
 * **Zu prüfende Vokabeln zählen nicht mit** (V-09, `practiceReadySql`):
 * Was hier nicht abgefragt wird, darf auch nicht als fällig erscheinen –
 * sonst stünde eine Zahl da, die kein „Loslegen" je abarbeiten kann.
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
    total: string;
    neu: string;
    am_ueben: string;
    sitzt: string;
  };

  return withActor(actor, async (tx) => {
    const rows = await tx.execute<Row>(
      sql`with karte_pro_vokabel as (
            select
              coalesce(vi.subject_id, t.subject_id) as subj_id,
              coalesce(c.vocab_item_id, c.id)       as vok_key,
              bool_and(c.state = 'neu')             as ganz_neu,
              bool_and(c.state = 'wiederholen')     as ganz_fest,
              bool_or(c.due_at <= now())            as faellig
            from card c
            left join vocab_item vi on vi.id = c.vocab_item_id
            left join learning_objective lo on lo.id = c.objective_id
            left join topic t on t.id = lo.topic_id
            where ${practiceReadySql}
            group by 1, 2
          )
          select
            s.id as subject_id, s.name as subject_name, s.language,
            count(*) filter (where kpv.faellig)::text as total,
            count(*) filter (where kpv.ganz_neu)::text as neu,
            count(*) filter (where not kpv.ganz_neu and not kpv.ganz_fest)::text as am_ueben,
            count(*) filter (where kpv.ganz_fest)::text as sitzt
          from karte_pro_vokabel kpv
          join subject s on s.id = kpv.subj_id
          group by s.id, s.name, s.language
          having count(*) filter (where kpv.faellig) > 0`,
    );

    return rows
      .map((row) => ({
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        language: row.language,
        total: Number(row.total),
        neu: Number(row.neu),
        amUeben: Number(row.am_ueben),
        sitzt: Number(row.sitzt),
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "de"));
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

type CardRow = {
  card_id: string;
  vocab_item_id: string;
  direction: Direction;
  state: CardStateValue;
  term: string;
  translation: string;
};

function toSessionCard(r: CardRow): SessionCardContent {
  return {
    cardId: r.card_id,
    vocabItemId: r.vocab_item_id,
    direction: r.direction,
    mode: modeForCardState(r.state),
    term: r.term,
    translation: r.translation,
  };
}

/**
 * Mindestgröße einer Fach-Session (V-04) – erste Schätzung, wie die
 * Zeitschwellen aus V-02. Reichen die fälligen Karten allein nicht, füllt
 * `loadSessionCards()` mit den Karten mit den meisten Fehlschlägen auf.
 */
const MIN_SESSION_SIZE = 10;

/**
 * Fällige Karten für eine Session, inhaltlich angereichert. Läuft immer in
 * genau einem Fach (V-06, ADR 0008 D3) – der Vorrat ist dadurch von selbst
 * einsprachig: `buildMultipleChoiceOptions()` zieht die Falschantworten aus
 * genau diesen Karten, eine eigene Fach-Regel dort ist nicht nötig.
 *
 * **Immer gemischt, ohne Richtungsparameter** (V-04, ADR 0015 Nachtrag): Der
 * Alltagsfluss auf `/ueben` trifft keine Vorentscheidung mehr. Wer gezielt
 * eine Richtung will, geht über den Set-Modus (`loadSetSessionCards()`) –
 * dort ist die Wahl ohnehin schon bewusst. Der vorherige
 * `direction`-Parameter hatte nach dem Wegfall der Umschalter nur noch
 * `null`-Aufrufer.
 *
 * **Gemischt liefert je Vokabel genau eine Karte** (V-06a), und **welche,
 * entscheidet `random()`** (V-07). Beide Karten sind ohnehin fällig
 * (`due_at <= now()`), die Reihenfolge dazwischen trägt kein Signal. Vorher
 * stand hier `order by … c.due_at asc, c.direction asc`, was „Gemischt"
 * faktisch auf Fremdwort → Deutsch festnagelte: Die beiden Karten einer
 * Vokabel haben in der Praxis **nie** exakt dasselbe `due_at`
 * (millisekundengenau, gegen die Produktiv-DB geprüft), also entschied immer
 * schon `due_at` – und wo es doch zum Gleichstand kam, sortiert Postgres das
 * `pgEnum` `vocab_direction` nach Deklarationsreihenfolge, nicht alphabetisch.
 *
 * **Zu prüfende Vokabeln bleiben draußen** (V-09, `practiceReadySql`): Eine
 * Zeile, bei der noch offen ist, ob sie stimmt, abzufragen hieße, dem Kind
 * womöglich Falsches als richtig zu bestätigen. Erst akzeptieren,
 * korrigieren oder wegwerfen – dann üben.
 *
 * **Schwachstellen fließen unsichtbar ein** (V-04, „Schwachstellen" aus §6
 * M4 ohne eigenen Button): Reichen die fälligen Karten nicht bis
 * `MIN_SESSION_SIZE`, holt die Session zusätzlich Karten desselben Fachs
 * dazu, die noch nicht fällig sind, aber am häufigsten schon einmal
 * gescheitert sind (`fsrs_state.lapses`, absteigend, dann die instabilsten
 * zuerst). FSRS entscheidet weiterhin, *wann* eine Karte reif ist – dies ist
 * nur eine zusätzliche Quelle für dieselbe Session, keine zweite Wahrheit
 * über Fälligkeit. `practiceReadySql` gilt hier genauso.
 */
export async function loadSessionCards(subjectId: string): Promise<SessionCardContent[] | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const due = await tx.execute<CardRow>(
      sql`select card_id, vocab_item_id, direction, state, term, translation from (
            select distinct on (c.vocab_item_id)
              c.id as card_id, c.vocab_item_id, c.direction, c.state,
              vi.term, vi.translation, c.due_at
            from card c join vocab_item vi on vi.id = c.vocab_item_id
            where c.due_at <= now() and vi.subject_id = ${subjectId}
              and ${practiceReadySql}
            order by c.vocab_item_id, random()
          ) gewaehlt
          order by due_at`,
    );

    const missing = MIN_SESSION_SIZE - due.length;
    const topUp =
      missing > 0
        ? await tx.execute<CardRow>(
            sql`select card_id, vocab_item_id, direction, state, term, translation from (
                  select distinct on (c.vocab_item_id)
                    c.id as card_id, c.vocab_item_id, c.direction, c.state,
                    vi.term, vi.translation,
                    (c.fsrs_state ->> 'lapses')::int as lapses,
                    (c.fsrs_state ->> 'stability')::float as stability
                  from card c join vocab_item vi on vi.id = c.vocab_item_id
                  where c.due_at > now() and vi.subject_id = ${subjectId}
                    and ${practiceReadySql}
                  order by c.vocab_item_id, random()
                ) gewaehlt
                order by lapses desc, stability asc
                limit ${missing}`,
          )
        : [];

    return [...due, ...topUp].map(toSessionCard);
  });
}

export type SetSessionInfo = {
  setTitle: string;
  subjectName: string;
  cards: SessionCardContent[];
};

/**
 * Ein Set gezielt üben, unabhängig von der Fälligkeit (V-04, „Set-Modus" aus
 * §6 M4). Der Einstieg lebt bewusst auf der Set-Seite
 * (`/faecher/vokabeln/[setId]`), nicht auf `/ueben` – wer hierher kommt, hat
 * das Set schon ausgewählt (ADR 0015 Nachtrag V-04). `direction` bleibt hier
 * wählbar (`null` = gemischt, dann je Vokabel eine zufällige Richtung wie im
 * Alltagsfluss), anders als auf `/ueben`.
 *
 * `practiceReadySql` gilt auch hier (V-09) – ein Set gezielt zu üben ist kein
 * Grund, ungeprüfte Zeilen abzufragen.
 *
 * `null`, wenn das Set nicht (mehr) existiert oder keine übbaren Karten in
 * der gewählten Richtung hat – dieselbe Ehrlichkeit wie bei
 * `loadSessionCards()`.
 */
export async function loadSetSessionCards(
  setId: string,
  direction: Direction | null,
): Promise<SetSessionInfo | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  type SetRow = { title: string; subject_name: string };

  return withActor(actor, async (tx) => {
    const [set] = await tx.execute<SetRow>(
      sql`select vs.title, s.name as subject_name
          from vocab_set vs join subject s on s.id = vs.subject_id
          where vs.id = ${setId}`,
    );
    if (!set) return null;

    const rows = await tx.execute<CardRow>(
      direction
        ? sql`select c.id as card_id, c.vocab_item_id, c.direction, c.state, vi.term, vi.translation
              from vocab_set_item vsi
              join vocab_item vi on vi.id = vsi.vocab_item_id
              join card c on c.vocab_item_id = vi.id
              where vsi.vocab_set_id = ${setId} and c.direction = ${direction}
                and ${practiceReadySql}`
        : sql`select distinct on (c.vocab_item_id)
                c.id as card_id, c.vocab_item_id, c.direction, c.state, vi.term, vi.translation
              from vocab_set_item vsi
              join vocab_item vi on vi.id = vsi.vocab_item_id
              join card c on c.vocab_item_id = vi.id
              where vsi.vocab_set_id = ${setId}
                and ${practiceReadySql}
              order by c.vocab_item_id, random()`,
    );
    if (rows.length === 0) return null;

    return {
      setTitle: set.title,
      subjectName: set.subject_name,
      cards: rows.map(toSessionCard),
    };
  });
}

/**
 * Drei Ausgänge statt eines bloßen `null` (F-09c) – `null` verschluckte bis
 * hierhin zwei ganz verschiedene Fälle: „im Moment nicht möglich, später
 * vielleicht wieder" und „wird nie mehr möglich sein". Die Offline-
 * Warteschlange (`flushAnswerQueue()`) muss beide unterscheiden können:
 * Ersteres bricht den weiteren Sync ab (Reihenfolge wahren), Zweiteres darf
 * den Eintrag verwerfen und mit dem Rest weitermachen – sonst blockiert eine
 * einzige inzwischen gelöschte Karte die gesamte Warteschlange für immer.
 */
export type AnswerResult =
  | { status: "ok"; outcome: Outcome }
  /** Keine Kind-Rolle (mehr) aktiv, oder keine Datenbank – kann sich ändern. */
  | { status: "not_authorized" }
  /** Karte oder Vokabel existiert nicht mehr – wird sich nicht mehr ändern. */
  | { status: "not_found" };

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
}): Promise<AnswerResult> {
  const actor = await requireStudentActor();
  if (!actor || actor.role !== "student") return { status: "not_authorized" };

  type CardRow = { fsrs_state: unknown; direction: Direction; vocab_item_id: string };
  type VocabRow = { term: string; translation: string };

  return withActor(actor, async (tx): Promise<AnswerResult> => {
    const [card] = await tx.execute<CardRow>(
      sql`select fsrs_state, direction, vocab_item_id from card where id = ${input.cardId}`,
    );
    if (!card) return { status: "not_found" };

    const [vocab] = await tx.execute<VocabRow>(
      sql`select term, translation from vocab_item where id = ${card.vocab_item_id}`,
    );
    if (!vocab) return { status: "not_found" };

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

    return { status: "ok", outcome };
  });
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
