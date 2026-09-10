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

import { timestamps } from "./columns";
import { student } from "./student";
import { tutorSession } from "./tutor";

/**
 * Hausaufgaben-Sitzung: die einzelnen Aufgaben (T-03, Konzept §4a).
 *
 * Eine Aufgabe hängt an einer `tutor_session` mit `entry_point =
 * 'hausaufgabe'` – das Gespräch ist schon da, hier kommt nur der Zustand je
 * Aufgabe dazu.
 *
 * **Der Zustand gehört der App, nicht dem Modell.** Das ist der Kern von
 * §4a und zugleich Bedingung 2 aus
 * [ADR 0011](../../../docs/adr/0011-sprache-im-tutor.md) D3: Wie viele
 * Versuche dokumentiert sind (`attempts`) und welche Hinweisstufe erreicht
 * ist (`hint_level`), entscheidet nicht das Gespräch, sondern diese Zeile.
 * Der Systemprompt bekommt daraus vorgegeben, was er sagen darf – „nie zwei
 * Stufen auf einmal" und „Lösung erst nach zwei Versuchen“ sind damit
 * Rechenregeln, keine Bitten (`src/lib/tutor/hint-ladder.ts`).
 *
 * **RLS: nur das Kind** – anders als in
 * [ADR 0004](../../../docs/adr/0004-datenmodell-rls.md) D4 ursprünglich
 * vorgesehen. Status, Versuche und Zeit sind Prozessdaten;
 * [ADR 0012](../../../docs/adr/0012-eltern-sehen-was-nicht-wie-gut.md) D3
 * hat sie dem Kind zugeschlagen. Eltern bekommen keine Policy.
 */

/** Die Status aus §4a („Ansicht“): offen · in Arbeit · gelöst · Lösung gezeigt · übersprungen. */
export const homeworkStatus = pgEnum("homework_status", [
  "offen",
  "in_arbeit",
  "geloest",
  "loesung_gezeigt",
  "uebersprungen",
]);

export const homeworkTask = pgTable(
  "homework_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    /** Reihenfolge im Foto – „eine Aufgabe nach der anderen“ (§4a Schritt 2). */
    position: integer("position").notNull(),
    /** Die Nummer, wie sie auf dem Blatt steht: „5a“, „Nr. 7“. Leer, wenn keine da war. */
    label: text("label"),
    /** Der Aufgabentext, wie Vision ihn gelesen hat. */
    prompt: text("prompt").notNull(),
    status: homeworkStatus("status").notNull().default("offen"),
    /**
     * Dokumentierte Versuche (§4a: „Versuch = Eingabe, nicht Klick“).
     * „Weiß ich nicht“ erhöht das hier **nicht** – siehe `zaehltAlsVersuch()`.
     */
    attempts: integer("attempts").notNull().default(0),
    /**
     * Erreichte Hinweisstufe, 0–4 (§4a Hinweisleiter). 0 = noch kein
     * Hinweis. Steigt immer um genau eins, nie um zwei.
     */
    hintLevel: integer("hint_level").notNull().default(0),
    /** Für den Zeitbedarf aus §4a („nach 20 Minuten an einer Aufgabe …“). */
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "homework_task_session_fk",
      columns: [t.sessionId, t.studentId],
      foreignColumns: [tutorSession.id, tutorSession.studentId],
    }).onDelete("cascade"),
    unique("homework_task_id_student_id_key").on(t.id, t.studentId),
    unique("homework_task_session_position_key").on(t.sessionId, t.position),
  ],
);
