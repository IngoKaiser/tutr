import {
  check,
  date,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { family, student } from "./family";

/**
 * Schuljahr, Fach, Thema (Topic), Lernziel – die zweite Schicht der
 * Kernkette (CLAUDE.md, Konzept §8/§9/§10, ADR 0004 D3/D6).
 *
 * Namensregel (ADR 0004 D8, fix(naming) #14): Bezeichner durchgängig
 * englisch, Domänen-*Werte* (Enum-Werte) deutsche ASCII-Domänensprache.
 */

const zeitstempel = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// --- Enums ------------------------------------------------------------
// Werte deutsch/ASCII (ADR 0004 D8) – App-Sprache ist Deutsch, das betrifft
// nur Bezeichner, nicht Inhalte.

/**
 * Lebenszyklus eines Schuljahres. Konzept §9 nennt nur "aktiv" explizit
 * (genau eins pro Schüler) und "Historie" für vergangene Jahre; "geplant"
 * ist eine Ergänzung von mir für den Sommer-Assistenten (§9: neues Jahr wird
 * vorbelegt, aber erst nach Bestätigung aktiv) – im Konzept nicht wörtlich
 * als Statuswert benannt, aus dem Ablauf abgeleitet.
 */
export const schoolYearStatus = pgEnum("school_year_status", ["geplant", "aktiv", "archiviert"]);

/**
 * Thema-Status (§10): Vorauswahl aus dem Kurrikulum-Pack (gedämpft
 * dargestellt) vs. angetippt/eigenes Thema.
 */
export const topicStatus = pgEnum("topic_status", ["vorauswahl", "aktiv"]);

/** Die sechs Lernpfad-Stufen aus §3, ASCII (kein "prüfen"). */
export const pathwayStage = pgEnum("pathway_stage", [
  "vorschau",
  "verstehen",
  "festigen",
  "anwenden",
  "pruefen",
  "nachbereitung",
]);

/** Selbsteinschätzung beim Themenstart, 5 Stufen (§15-Ergänzung). */
export const selfAssessmentLevel = pgEnum("self_assessment_level", [
  "neu",
  "gehoert",
  "grundlagen",
  "versteht_gut",
  "sicher",
]);

// --- school_year --------------------------------------------------------
// Zeitscheibe (§9): genau ein "aktiv" pro Schüler, erzwungen als partieller
// Unique-Index statt per Anwendungscode.

export const schoolYear = pgTable(
  "school_year",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    label: text("label").notNull(),
    gradeLevel: integer("grade_level").notNull(),
    className: text("class_name"),
    // Verweise auf F-04d-Referenzdaten (school_profile, curriculum_pack) –
    // bewusst ohne Fremdschlüssel, bis diese Tabellen existieren.
    schoolProfileId: uuid("school_profile_id"),
    curriculumPackId: uuid("curriculum_pack_id"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: schoolYearStatus("status").notNull(),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    unique("school_year_id_student_id_key").on(t.id, t.studentId),
    unique("school_year_id_family_id_key").on(t.id, t.familyId),
    uniqueIndex("school_year_one_active_per_student")
      .on(t.studentId)
      .where(sql`${t.status} = 'aktiv'`),
  ],
);

// --- subject --------------------------------------------------------------
// Hängt am Schüler, nicht am Schuljahr (ADR 0004 D6) – Französisch bleibt
// Französisch über Schuljahre hinweg.

export const subject = pgTable(
  "subject",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    name: text("name").notNull(),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    unique("subject_id_student_id_key").on(t.id, t.studentId),
    unique("subject_id_family_id_key").on(t.id, t.familyId),
    unique("subject_student_id_name_key").on(t.studentId, t.name),
  ],
);

// --- topic (Thema) ----------------------------------------------------
// Fachbindung als DB-Constraint (§15 Fehler 2, ADR 0004 D3): topic hängt an
// (subject_id, student_id) – ein topic ohne passendes Fach kann nicht
// eingefügt werden. Drei Unique-Anker (subject_id/student_id/family_id) auf
// derselben id, damit spätere Tabellen (learning_objective, K-01
// calendar_event_topic) direkt gegen die jeweils passende Spalte
// referenzieren können, ohne Join.

export const topic = pgTable(
  "topic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    schoolYearId: uuid("school_year_id").notNull(),
    title: text("title").notNull(),
    // Herkunft des Themas als Freitext, bis F-04d curriculum_node/textbook
    // existieren und die Referenzen unten scharf geschaltet werden können.
    source: text("source"),
    curriculumNodeRef: uuid("curriculum_node_ref"),
    textbookRef: uuid("textbook_ref"),
    status: topicStatus("status").notNull(),
    sequence: integer("sequence").notNull().default(0),
    pathwayStage: pathwayStage("pathway_stage").notNull().default("vorschau"),
    selfAssessment: selfAssessmentLevel("self_assessment"),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.subjectId, t.studentId],
      foreignColumns: [subject.id, subject.studentId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.schoolYearId, t.studentId],
      foreignColumns: [schoolYear.id, schoolYear.studentId],
    }).onDelete("restrict"),
    unique("topic_id_subject_id_key").on(t.id, t.subjectId),
    unique("topic_id_student_id_key").on(t.id, t.studentId),
    unique("topic_id_family_id_key").on(t.id, t.familyId),
  ],
);

// --- learning_objective -----------------------------------------------
// §8 nennt nur niveauBeschreibungen/vorlaeuferIds/mastery – "title" fehlt in
// der Spec-Skizze, ist aber offensichtlich nötig (ein Lernziel ohne lesbaren
// Namen ist nicht nutzbar) und deshalb ergänzt.
// Mastery (abdeckung/sicherheit) bewusst NICHT hier – die ist laut ADR 0004
// D5 abgeleitet und kommt als Cache-Tabelle objective_mastery mit M-03.

export const learningObjective = pgTable(
  "learning_objective",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    topicId: uuid("topic_id").notNull(),
    title: text("title").notNull(),
    // Niveaubeschreibungen als drei Spalten statt JSONB (ADR-Vorentscheidung
    // vor F-04c): die drei Niveaustufen aus §3 sind fest, kein offenes Schema.
    descriptionGrundlegend: text("description_grundlegend"),
    descriptionRegel: text("description_regel"),
    descriptionErhoeht: text("description_erhoeht"),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.topicId, t.studentId],
      foreignColumns: [topic.id, topic.studentId],
    }).onDelete("restrict"), // Lernhistorie darf nicht mit einem gelöschten Thema verschwinden.
    unique("learning_objective_id_student_id_key").on(t.id, t.studentId),
    unique("learning_objective_id_family_id_key").on(t.id, t.familyId),
  ],
);

// --- objective_prerequisite ---------------------------------------------
// Selbstreferenz (ADR 0004 D5). Vorläufer dürfen laut §3 aus einem anderen
// Thema/Fach/Schuljahr stammen ("auch aus früheren Schuljahren") – deshalb
// keine Bindung an dasselbe topic, nur an denselben Schüler/dieselbe Familie.

export const objectivePrerequisite = pgTable(
  "objective_prerequisite",
  {
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    objectiveId: uuid("objective_id").notNull(),
    prerequisiteObjectiveId: uuid("prerequisite_objective_id").notNull(),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    // Expliziter Name: der lange Tabellenname lässt Drizzles Standardname
    // hier die 63-Zeichen-Grenze für Postgres-Identifier überschreiten.
    foreignKey({
      name: "objective_prerequisite_student_fk",
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    foreignKey({
      name: "objective_prerequisite_objective_fk",
      columns: [t.objectiveId, t.studentId],
      foreignColumns: [learningObjective.id, learningObjective.studentId],
    }).onDelete("cascade"),
    // Expliziter, kurzer Name: der von Drizzle generierte Standardname
    // überschreitet Postgres' 63-Zeichen-Grenze für Identifier und würde
    // sonst stillschweigend gekürzt (Notice beim Anwenden der Migration).
    foreignKey({
      name: "objective_prerequisite_prerequisite_fk",
      columns: [t.prerequisiteObjectiveId, t.studentId],
      foreignColumns: [learningObjective.id, learningObjective.studentId],
    }).onDelete("cascade"),
    unique("objective_prerequisite_pk").on(t.objectiveId, t.prerequisiteObjectiveId),
    check("objective_prerequisite_not_self", sql`${t.objectiveId} <> ${t.prerequisiteObjectiveId}`),
  ],
);
