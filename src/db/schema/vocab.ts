import {
  boolean,
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
import { learningObjective, schoolYear, subject } from "./curriculum";
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
 *
 * **Fachbindung (V-05, ADR 0008 D1/D2):** Ein Fach ist der Raum, in dem
 * geübt wird, kein abschaltbarer Filter – es gibt keinen Zustand „ohne
 * Fach". Gespeichert wird das Fach nur dort, wo die Ableitung mehrdeutig
 * wäre (n:m): `vocab_item.subjectId`. `vocab_set` trägt es schon (n:1 zu
 * `subject`), `card` bekommt keine eigene Spalte – der Weg über
 * `vocab_item` ist ein einzelner, indizierter Join, keine Spekulation auf
 * eine Last wie bei `due_at`/`state`. `vocab_set_item` trägt das Fach
 * ebenfalls und bindet beide Seiten dagegen (derselbe Kniff wie bei
 * `student_id`, ADR 0004 D2): Eine Vokabel eines Fachs kann strukturell
 * nicht in einem Set eines anderen Fachs landen, kein Anwendungscode nötig.
 *
 * **Jahresbindung (F-16a, ADR 0009 D4):** `vocab_set` trägt zusätzlich
 * `schoolYearId` – ein Set ist eine Ordnungshilfe ohne eigenen Lernstand und
 * darf deshalb jahresgebunden sein. `vocab_item`, `card`, `review` bleiben
 * ausdrücklich ohne diese Spalte (ADR 0004 D6, dort geschärft): Was gelernt
 * wurde, bleibt zeitlos, auch wenn das Set, über das es hereinkam, aus dem
 * Sichtfenster fällt.
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
    // Der Behälter ist jahresgebunden, der Lernstand nicht (ADR 0009 D4):
    // Ein Set ist eine Ordnungshilfe ohne eigenen FSRS-Zustand – anders als
    // `vocab_item`/`card`/`review`, die absichtlich **keine** Spalte dieser
    // Art tragen (ADR 0004 D6). Restrict wie bei `topic`: ein gelöschtes
    // Schuljahr reißt die Sets nicht mit, sie müssten erst einzeln weg.
    schoolYearId: uuid("school_year_id").notNull(),
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
    foreignKey({
      name: "vocab_set_school_year_fk",
      columns: [t.schoolYearId, t.studentId],
      foreignColumns: [schoolYear.id, schoolYear.studentId],
    }).onDelete("restrict"),
    // Einfacher FK wie chapter → textbook (dieselbe „Bekannte Restlücke"):
    // ein Kapitel kann kuratiert (student_id null) sein.
    foreignKey({ columns: [t.chapterId], foreignColumns: [chapter.id] }).onDelete("cascade"),
    unique("vocab_set_id_student_id_key").on(t.id, t.studentId),
    // Anker für die Fachbindung von `vocab_set_item` (V-05) – dieselbe
    // Spalte, nur als zusätzlicher Unique-Index erreichbar, kein neuer Wert.
    unique("vocab_set_id_student_id_subject_id_key").on(t.id, t.studentId, t.subjectId),
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
    // Eigene Spalte, nicht abgeleitet (V-05, ADR 0008 D1): Der Weg über
    // `vocab_set_item` ist n:m und wäre für ein Item ohne Set (möglich seit
    // `deleteSet()`) gar nicht vorhanden.
    subjectId: uuid("subject_id").notNull(),
    // Foto-Extraktion liefert laut §6 M4 genau diese Felder.
    term: text("term").notNull(),
    translation: text("translation").notNull(),
    /**
     * Die Erkennung war sich bei dieser Zeile unsicher (V-03b, ADR 0007 D2).
     *
     * Die einzige der drei Unsicherheits-Ursachen, die **gespeichert** werden
     * muss: „leeres Feld" und „gleiches Wort, andere Übersetzung" lassen sich
     * beim Lesen ableiten, niedrige Konfidenz nicht – sie ist eine Tatsache
     * aus dem Moment des Imports, die keine spätere Abfrage rekonstruieren
     * kann. ADR 0006 D7 („was sich ableiten lässt, wird nicht gespeichert")
     * steht dem nicht entgegen, sondern begründet genau diese Ausnahme.
     *
     * Wird zurückgesetzt, sobald jemand die Zeile bearbeitet: Dann hat ein
     * Mensch daraufgeschaut, und darum ging es.
     */
    recognitionUncertain: boolean("recognition_uncertain").notNull().default(false),
    partOfSpeech: text("part_of_speech"),
    example: text("example"),
    hint: text("hint"),
    page: text("page"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "vocab_item_subject_fk",
      columns: [t.subjectId, t.studentId],
      foreignColumns: [subject.id, subject.studentId],
      // Restrict wie bei vocab_set: ein gelöschtes Fach reißt keine Vokabeln mit.
    }).onDelete("restrict"),
    unique("vocab_item_id_student_id_key").on(t.id, t.studentId),
    unique("vocab_item_id_student_id_subject_id_key").on(t.id, t.studentId, t.subjectId),
  ],
);

// --- vocab_set_item -------------------------------------------------------
// n:m zwischen Set und Vokabel (ADR 0004 D5 nennt diese Tabelle namentlich).
//
// `subjectId` steht hier zusätzlich zu Set und Vokabel, damit die beiden
// zusammengesetzten Fremdschlüssel unten das Fach auf beiden Seiten gegen
// dieselbe Spalte binden (V-05, ADR 0008 D2) – eine Vokabel eines Fachs
// kann dadurch strukturell nicht in einem Set eines anderen Fachs landen,
// ganz ohne Anwendungscode, der das prüfen müsste.

export const vocabSetItem = pgTable(
  "vocab_set_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    vocabSetId: uuid("vocab_set_id").notNull(),
    vocabItemId: uuid("vocab_item_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "vocab_set_item_set_fk",
      columns: [t.vocabSetId, t.studentId, t.subjectId],
      foreignColumns: [vocabSet.id, vocabSet.studentId, vocabSet.subjectId],
    }).onDelete("cascade"),
    foreignKey({
      name: "vocab_set_item_item_fk",
      columns: [t.vocabItemId, t.studentId, t.subjectId],
      foreignColumns: [vocabItem.id, vocabItem.studentId, vocabItem.subjectId],
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
