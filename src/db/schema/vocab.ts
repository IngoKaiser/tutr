import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { timestamps } from "./columns";
import { learningObjective, subject } from "./curriculum";
import { student } from "./student";
import { chapter } from "./textbook";

/**
 * Vokabeltrainer (V-01, Konzept §6 M4, §8).
 *
 * `vocab_set` und `vocab_item` sind eigene Daten des Kindes (fotografiert
 * oder selbst angelegt) – anders als `textbook`/`chapter` gibt es hier keine
 * kuratierte Variante, `student_id` ist also überall `not null` (ADR 0004
 * D7 betrifft diese Tabellen nicht).
 *
 * `card` ist bewusst **generisch** gehalten, nicht `vocab_card`: §8
 * modelliert `Card (objectiveId, ...)` und `Review (cardId, ...)` als eine
 * Einheit für alle Karten, nicht nur Vokabeln. M-03 („Karten-Generierung aus
 * Material") braucht dieselbe Tabelle für Karten aus Lernzielen – mit
 * `vocab_item_id` UND `objective_id` als eigene, nullbare Spalten kostet das
 * heute nichts und M-03 später keine Umbenennung. Ein Check erzwingt, dass
 * jede Karte zu genau einer Quelle gehört.
 *
 * RLS-Richtung (ADR 0004 D4, Zeile `card, review, vocab_*`): Kind liest und
 * schreibt, Eltern lesen nur – wie `topic`/`learning_objective`, aus
 * demselben Grund: Übungsfortschritt ist Tagesgeschäft des Kindes.
 */

/** Card.state aus `ts-fsrs`, gespiegelt als deutscher ASCII-Wert (ADR 0006 D10). */
export const cardState = pgEnum("card_state", ["neu", "lernen", "wiederholen", "erneut_lernen"]);

/** §6 M4: „Beide Richtungen als getrennte Karten." */
export const vocabDirection = pgEnum("vocab_direction", ["vorwaerts", "rueckwaerts"]);

/** Rating aus `ts-fsrs`, ohne `Manual` – das ist kein Ergebnis einer echten Session. */
export const reviewRating = pgEnum("review_rating", ["nochmal", "schwierig", "gut", "leicht"]);

// --- vocab_set --------------------------------------------------------
// „Sprache → Lehrwerk → Unit → Set" (§6 M4). Die Sprache steckt in
// `subjectId` (ein Fach *ist* hier eine Sprache), Lehrwerk/Unit sind
// optional – eigene Sets ("Klassenarbeit 2") brauchen kein Kapitel.

export const vocabSet = pgTable(
  "vocab_set",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    // Freitext statt Fremdschlüssel auf `chapter.units` (text[]) – Arrays
    // können kein FK-Ziel sein, siehe Kommentar dort.
    chapterId: uuid("chapter_id"),
    unit: text("unit"),
    title: text("title").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "vocab_set_subject_fk",
      columns: [t.subjectId, t.studentId],
      foreignColumns: [subject.id, subject.studentId],
      // Restrict wie topic → school_year: Vokabelsets sollen ein gelöschtes
      // Fach nicht stillschweigend mitreißen.
    }).onDelete("restrict"),
    // Einfacher FK wie chapter → textbook (dieselbe „Bekannte Restlücke"):
    // ein Kapitel kann kuratiert (student_id null) sein.
    foreignKey({ columns: [t.chapterId], foreignColumns: [chapter.id] }).onDelete("cascade"),
    unique("vocab_set_id_student_id_key").on(t.id, t.studentId),
  ],
);

// --- vocab_item ---------------------------------------------------------
// Die Vokabel selbst, ohne Bezug zu einem Set – die Zuordnung ist n:m
// (§6 M4: „eine Vokabel in mehreren Sets"), lebt in `vocab_set_item`.

export const vocabItem = pgTable(
  "vocab_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    // Foto-Extraktion liefert laut §6 M4 genau diese Felder.
    term: text("term").notNull(),
    translation: text("translation").notNull(),
    partOfSpeech: text("part_of_speech"),
    example: text("example"),
    hint: text("hint"),
    page: text("page"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    unique("vocab_item_id_student_id_key").on(t.id, t.studentId),
  ],
);

// --- vocab_set_item -------------------------------------------------------
// n:m zwischen Set und Vokabel (ADR 0004 D5 nennt diese Tabelle namentlich).

export const vocabSetItem = pgTable(
  "vocab_set_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    vocabSetId: uuid("vocab_set_id").notNull(),
    vocabItemId: uuid("vocab_item_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "vocab_set_item_set_fk",
      columns: [t.vocabSetId, t.studentId],
      foreignColumns: [vocabSet.id, vocabSet.studentId],
    }).onDelete("cascade"),
    foreignKey({
      name: "vocab_set_item_item_fk",
      columns: [t.vocabItemId, t.studentId],
      foreignColumns: [vocabItem.id, vocabItem.studentId],
    }).onDelete("cascade"),
    unique("vocab_set_item_pair_key").on(t.vocabSetId, t.vocabItemId),
  ],
);

// --- card -----------------------------------------------------------------
// Generisch (siehe Dateikommentar). `fsrs_state` ist die einzige Wahrheit
// über den FSRS-Zustand (JSONB, ADR 0004 D5); `due_at`/`state` sind
// Spiegel-Spalten für Indizes – geschrieben nur in `src/lib/vocab/fsrs.ts`.
//
// Fürs Schreiben über die `sql`-Vorlage: Ein rohes JS-Objekt als Parameter
// für `jsonb` wirft „argument must be of type string" – wie beim
// JS-Array-in-text[]-Fund aus F-06. Erst `JSON.stringify(...)` und mit
// `::jsonb` casten, oder den Query-Builder statt der Vorlage nehmen.

export const card = pgTable(
  "card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    vocabItemId: uuid("vocab_item_id"),
    objectiveId: uuid("objective_id"),
    // Nur bei Vokabelkarten gesetzt – siehe Check unten.
    direction: vocabDirection("direction"),
    fsrsState: jsonb("fsrs_state").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    state: cardState("state").notNull().default("neu"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "card_vocab_item_fk",
      columns: [t.vocabItemId, t.studentId],
      foreignColumns: [vocabItem.id, vocabItem.studentId],
    }).onDelete("cascade"),
    foreignKey({
      name: "card_objective_fk",
      columns: [t.objectiveId, t.studentId],
      foreignColumns: [learningObjective.id, learningObjective.studentId],
      // Restrict wie learning_objective → topic: Lernhistorie darf nicht
      // mit einem gelöschten Lernziel verschwinden.
    }).onDelete("restrict"),
    unique("card_id_student_id_key").on(t.id, t.studentId),
    // Genau eine Karte je Vokabel und Richtung.
    unique("card_vocab_item_direction_key").on(t.vocabItemId, t.direction),
    check(
      "card_exactly_one_source",
      sql`(vocab_item_id is not null) <> (objective_id is not null)`,
    ),
    check("card_direction_only_for_vocab", sql`(vocab_item_id is null) = (direction is null)`),
  ],
);

// --- review -----------------------------------------------------------
// Das Protokoll. `reviewed_at` ist der fachliche Zeitpunkt (wie
// `parent_student.consent_at`), `created_at`/`updated_at` bleiben die
// technischen Spalten aus `timestamps` – bei einer unveränderlichen
// Log-Zeile fallen beide praktisch zusammen, aber die Unterscheidung kostet
// nichts und hält das Muster einheitlich.
//
// Kein `self_assessment` (anders als die generische Skizze in §8): M4 nennt
// für die Vokabel-Session nur die Bewertung selbst und die Antwortzeit: MC
// und Tippen fragen nicht "wie sicher warst du", das FSRS-Rating trägt das
// schon. Ein ungenutztes Feld jetzt anzulegen wäre eine Spekulation ohne
// Abnehmer – kommt mit M-03 nach, falls der Tutor es braucht.

export const review = pgTable(
  "review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    cardId: uuid("card_id").notNull(),
    rating: reviewRating("rating").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    responseMs: integer("response_ms"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "review_card_fk",
      columns: [t.cardId, t.studentId],
      foreignColumns: [card.id, card.studentId],
    }).onDelete("cascade"),
  ],
);
