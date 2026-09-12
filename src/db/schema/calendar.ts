import { date, foreignKey, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { schoolYear, subject } from "./curriculum";
import { student } from "./student";

/**
 * Prüfungskalender (K-01, Konzept §6 M7, §8 `CalendarEvent`).
 *
 * Die schmale Fassung: von Hand eingetragene Termine, mehr nicht. Import
 * (K-02–K-04), Themen-Verknüpfung (P-01), Note/Nachbereitung und Lernplan
 * kommen später – das §8-Modell nennt für `CalendarEvent` außerdem `start`,
 * `ende`, `gruppen`, `ergebnis`, `quelle`, `historie`; alle davon gehören zu
 * Kanälen, die K-01 noch nicht hat.
 *
 * Fachbindung wie `topic` (ADR 0004 D3, §15 Fehler 2): `calendar_event`
 * hängt an `(subject_id, student_id)` – ein Termin ohne passendes Fach kann
 * nicht eingefügt werden. Zwei Unique-Anker auf der `id`, damit P-01 die
 * Themen-Verknüpfung (`calendar_event_topic`) direkt gegen student **und**
 * subject binden kann, ohne Join – „eine Prüfung verknüpft nur Themen ihres
 * Fachs" wird dann zum DB-Constraint.
 *
 * RLS (ADR 0004 D4, Zeile `calendar_event, study_plan_slot`): **beide
 * Rollen** lesen und schreiben. Ein Elternteil trägt genauso Termine ein wie
 * das Kind.
 */

/** Art des Termins. Blocker (Ferien/Fahrt) kommen mit dem Import (§6 M7), nicht hier. */
export const calendarEventType = pgEnum("calendar_event_type", [
  "klassenarbeit",
  "test",
  "muendlich",
  "abgabe",
  "sonstiges",
]);

/** „Absagen = Status, behält Verlauf" (§6 M7). „erledigt"/Note kommt mit der Nachbereitung. */
export const calendarEventStatus = pgEnum("calendar_event_status", ["geplant", "abgesagt"]);

export const calendarEvent = pgTable(
  "calendar_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    schoolYearId: uuid("school_year_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    type: calendarEventType("type").notNull(),
    title: text("title").notNull(),
    date: date("date").notNull(),
    status: calendarEventStatus("status").notNull().default("geplant"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    // Restrict wie `vocab_set` → `subject` (ADR 0009): ein gelöschtes Fach
    // reißt keine Termine mit. `deleteSubject()` zählt sie vorher und lehnt
    // mit einem deutschen Satz ab.
    foreignKey({
      name: "calendar_event_subject_fk",
      columns: [t.subjectId, t.studentId],
      foreignColumns: [subject.id, subject.studentId],
    }).onDelete("restrict"),
    // Cascade wie `school_year_subject` → `school_year`: das Umschalten von
    // Schuljahren (F-16b) räumt die Termine des alten Jahres mit ab.
    foreignKey({
      name: "calendar_event_school_year_fk",
      columns: [t.schoolYearId, t.studentId],
      foreignColumns: [schoolYear.id, schoolYear.studentId],
    }).onDelete("cascade"),
    unique("calendar_event_id_student_id_key").on(t.id, t.studentId),
    unique("calendar_event_id_subject_id_key").on(t.id, t.subjectId),
  ],
);
