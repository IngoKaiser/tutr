import { foreignKey, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { schoolYear, subject } from "./curriculum";
import { student } from "./student";

/**
 * Lehrwerk-Registry (Konzept §7 „Lehrwerk-Registry", §10) und die Zuordnung
 * Schuljahr+Fach → Lehrwerk.
 *
 * `textbook` und `chapter` folgen dem kuratiert-oder-eigen-Muster aus
 * ADR 0004 D7: `student_id` ist nullable. NULL = kuratierter Datensatz, den
 * nur die Migrationsrolle schreibt; gesetzt = von diesem Kind selbst angelegt
 * (z. B. aus einem Foto des Inhaltsverzeichnisses).
 *
 * Angenommener Preis des Neuschnitts (ADR 0006): Geschwister an derselben
 * Schule teilen kein eigenes Lehrwerk mehr – jedes Kind bekommt eine eigene
 * Zeile. Den Normalfall deckt die kuratierte Schicht ab.
 */

/**
 * Woher die Kapitelstruktur stammt (§10: „Inhaltsverzeichnis-Foto
 * (zuverlässig) → Claudes Vorwissen (markiert) → Verlags-PDFs (manuell)").
 * Die Unterscheidung ist nicht kosmetisch: `claude_vorwissen` muss in der UI
 * als Vorschlag markiert werden.
 *
 * `claude_vorwissen` grundet seit L-01 auf einer echten Websuche
 * (`suggestTextbookViaWebSearch()`), nicht mehr nur auf reinem
 * Trainingswissen wie in §10 skizziert – am Enum-Namen und an der Pflicht zur
 * Markierung ändert das nichts: Es bleibt Claudes Vorschlag, keine
 * abgelesene Tatsache, und wird erst nach Bestätigung gespeichert.
 *
 * `manuell` hat seit L-01 **keinen** eigenen Erfassungsweg in der App mehr
 * (Foto/Websuche decken das ab, die editierbare Kapitelliste danach ersetzt
 * die reine Handeingabe) – der Wert bleibt für kuratierte, per Migration
 * eingepflegte Lehrwerke (z. B. `seed.ts`) und für `verlags_pdf` als noch
 * ungebauten dritten Weg (§10) stehen.
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
    studentId: uuid("student_id"),
    // §8 skizziert für Lehrwerk nur die Kapitel-Struktur, keinen Titel –
    // ohne lesbaren Namen ist der Eintrag aber nicht benutzbar. Ergänzt.
    title: text("title").notNull(),
    // Freitext, kein Fremdschlüssel auf `subject`: Referenzdaten sind
    // schulagnostisch (§7) und hängen an keinem Schülerprofil.
    subject: text("subject").notNull(),
    gradeLevel: integer("grade_level"),
    publisher: text("publisher"),
    source: textbookSource("source"),
    ...timestamps,
  },
  (t) => [foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade")],
);

export const chapter = pgTable(
  "chapter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: NULL = kuratiert (ADR 0004 D7).
    studentId: uuid("student_id"),
    textbookId: uuid("textbook_id").notNull(),
    title: text("title").notNull(),
    // Seitenangabe als Freitext ("34–51"), weil Bücher auch römisch oder
    // mit Abschnittsnummern zählen.
    pages: text("pages"),
    sequence: integer("sequence").notNull().default(0),
    // Vokabel-Units dieses Kapitels (§6 M4: Lehrwerk → Unit → Set). Nur
    // Bezeichner; die Sets selbst entstehen mit V-01.
    units: text("units").array().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    // Bewusst einfacher Fremdschlüssel statt zusammengesetzt: `student_id`
    // ist hier nullable, ein zusammengesetzter FK würde bei NULL ohnehin
    // nicht prüfen (MATCH SIMPLE) und ein eigenes Kapitel an einem
    // kuratierten Lehrwerk unmöglich machen. Bekannte Restlücke: Postgres
    // prüft Fremdschlüssel ohne RLS, ein Kind könnte also auf ein fremdes,
    // nicht kuratiertes Lehrwerk verweisen, wenn es dessen UUID kennt –
    // lesen kann es das weiterhin nicht.
    foreignKey({ columns: [t.textbookId], foreignColumns: [textbook.id] }).onDelete("cascade"),
  ],
);

/**
 * Welches Lehrwerk gilt in diesem Schuljahr für dieses Fach – §8
 * `SchoolYear.lehrwerke{fach→id}` als Join-Tabelle statt Map (ADR 0004 D5).
 * Anders als `textbook` selbst ist das eine eigene Entscheidung des Kindes
 * und folgt darum dem normalen Muster: `student_id` NOT NULL, Eltern schreiben.
 */
export const schoolYearTextbook = pgTable(
  "school_year_textbook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    schoolYearId: uuid("school_year_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    textbookId: uuid("textbook_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
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
