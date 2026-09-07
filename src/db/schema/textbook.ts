import {
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { schoolYear, subject } from "./curriculum";
import { family, student } from "./family";

/**
 * Lehrwerk-Registry (Konzept §7 „Lehrwerk-Registry", §10) und die Zuordnung
 * Schuljahr+Fach → Lehrwerk.
 *
 * `textbook` und `chapter` folgen dem kuratiert-oder-eigen-Muster aus
 * ADR 0004 D7: `family_id` ist nullable. NULL = kuratierter Datensatz, den
 * nur die Migrationsrolle schreibt; gesetzt = von dieser Familie selbst
 * angelegt (z. B. aus einem Foto des Inhaltsverzeichnisses).
 */

const zeitstempel = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Woher die Kapitelstruktur stammt (§10: „Inhaltsverzeichnis-Foto
 * (zuverlässig) → Claudes Vorwissen (markiert) → Verlags-PDFs (manuell)",
 * dazu manuelle Eingabe aus L-01). Die Unterscheidung ist nicht kosmetisch:
 * `claude_vorwissen` muss in der UI als Vorschlag markiert werden.
 */
export const textbookSource = pgEnum("textbook_source", [
  "foto",
  "manuell",
  "claude_vorwissen",
  "verlags_pdf",
]);

export const textbook = pgTable(
  "textbook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: NULL = kuratiert (ADR 0004 D7).
    familyId: uuid("family_id"),
    // §8 skizziert für Lehrwerk nur die Kapitel-Struktur, keinen Titel –
    // ohne lesbaren Namen ist der Eintrag aber nicht benutzbar. Ergänzt.
    title: text("title").notNull(),
    // Freitext, kein Fremdschlüssel auf `subject`: Referenzdaten sind
    // schulagnostisch (§7) und hängen an keinem Schülerprofil.
    subject: text("subject").notNull(),
    gradeLevel: integer("grade_level"),
    publisher: text("publisher"),
    source: textbookSource("source"),
    ...zeitstempel,
  },
  (t) => [foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade")],
);

export const chapter = pgTable(
  "chapter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id"),
    textbookId: uuid("textbook_id").notNull(),
    title: text("title").notNull(),
    // Seitenangabe als Freitext ("34–51"), weil Bücher auch römisch oder
    // mit Abschnittsnummern zählen.
    pages: text("pages"),
    sequence: integer("sequence").notNull().default(0),
    // Vokabel-Units dieses Kapitels (§6 M4: Lehrwerk → Unit → Set). Nur
    // Bezeichner; die Sets selbst entstehen mit V-01.
    units: text("units").array().notNull().default([]),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    // Bewusst einfacher Fremdschlüssel statt zusammengesetzt: `family_id` ist
    // hier nullable, ein zusammengesetzter FK würde bei NULL ohnehin nicht
    // prüfen (MATCH SIMPLE) und ein familieneigenes Kapitel an einem
    // kuratierten Lehrwerk unmöglich machen. Bekannte Restlücke: Postgres
    // prüft Fremdschlüssel ohne RLS, eine Familie könnte also auf ein
    // fremdes, nicht kuratiertes Lehrwerk verweisen, wenn sie dessen UUID
    // kennt – lesen kann sie es weiterhin nicht.
    foreignKey({ columns: [t.textbookId], foreignColumns: [textbook.id] }).onDelete("cascade"),
  ],
);

/**
 * Welches Lehrwerk gilt in diesem Schuljahr für dieses Fach – §8
 * `SchoolYear.lehrwerke{fach→id}` als Join-Tabelle statt Map (ADR 0004 D5).
 * Anders als `textbook` selbst ist das eine familieneigene Entscheidung und
 * folgt darum dem normalen Muster: `family_id` NOT NULL, Eltern schreiben.
 */
export const schoolYearTextbook = pgTable(
  "school_year_textbook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    schoolYearId: uuid("school_year_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    textbookId: uuid("textbook_id").notNull(),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      name: "school_year_textbook_student_fk",
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    foreignKey({
      name: "school_year_textbook_school_year_fk",
      columns: [t.schoolYearId, t.studentId],
      foreignColumns: [schoolYear.id, schoolYear.studentId],
    }).onDelete("cascade"),
    foreignKey({
      name: "school_year_textbook_subject_fk",
      columns: [t.subjectId, t.studentId],
      foreignColumns: [subject.id, subject.studentId],
    }).onDelete("cascade"),
    foreignKey({ columns: [t.textbookId], foreignColumns: [textbook.id] }).onDelete("restrict"),
    // §8 schreibt eine Map fach→id: pro Schuljahr und Fach genau ein Lehrwerk.
    unique("school_year_textbook_year_subject_key").on(t.schoolYearId, t.subjectId),
  ],
);
