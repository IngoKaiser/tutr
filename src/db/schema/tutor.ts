import {
  boolean,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { subject, topic } from "./curriculum";
import { student } from "./student";

/**
 * Der Tutor-Chat (T-02, Konzept §4/§15, ADR 0010).
 *
 * **Warum nur zwei Tabellen und nicht drei:** [ADR 0004](../../../docs/adr/0004-datenmodell-rls.md)
 * D4 sieht zusätzlich `tutor_session_summary` für die Elternsicht vor. Die
 * entsteht erst mit T-03 (Hausaufgaben), wo §4a den Zweizeiler definiert, der
 * hineingehört – eine Tabelle, die niemand schreibt, täuscht der Elternsicht
 * eine Funktion vor ([ADR 0010](../../../docs/adr/0010-tutor-architektur.md) D2).
 * Bis dahin gilt für Eltern: kein Zugriff auf den Tutor, keine Policy.
 *
 * **RLS-Richtung (ADR 0004 D4, Zeile `tutor_session, tutor_message`):** nur
 * das Kind, lesen und schreiben. Für Eltern gibt es **keine** Policy – kein
 * Zugriff, strukturell, nicht nur in der UI. `0070-tutor.sql` legt deshalb
 * bewusst nur `_student`-Policies an.
 *
 * **Fachbindung:** `tutor_session.subjectId` ist Pflicht – ohne Fach ist
 * weder die Antwortsprache (ADR 0010 D3) noch eine spätere Schicht
 * bestimmbar. `topicId` ist nullbar und bleibt in Stufe 1 leer (es gibt
 * keine Themen-Oberfläche, ADR 0010 D6); der zusammengesetzte Fremdschlüssel
 * gegen `(topic.id, topic.subject_id)` entsteht aber jetzt, damit ein Thema
 * später nur noch gesetzt werden muss und strukturell zum Fach der Session
 * passen **muss** (§15 Fehler 2).
 */

/** Die sieben Einstiege aus §4. Stufe 1 bietet nur `freie_frage` und `verstehen` an. */
export const tutorEntryPoint = pgEnum("tutor_entry_point", [
  "freie_frage",
  "verstehen",
  "vorschau",
  "vertiefen",
  "hausaufgabe",
  "pruefung",
  "nachbereitung",
]);

/** Wer die Nachricht geschrieben hat. ASCII-Werte (ADR 0006 D10). */
export const tutorMessageRole = pgEnum("tutor_message_role", ["nutzer", "tutor"]);

/** KI-Endpunkte, die gegen ein Limit zählen (S-03b). `vision` ist reserviert – V-03b zählt noch nicht mit. */
export const aiEndpoint = pgEnum("ai_endpoint", ["tutor", "vision"]);

// --- tutor_session ---------------------------------------------------------

export const tutorSession = pgTable(
  "tutor_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    topicId: uuid("topic_id"),
    /**
     * Aus der ersten Frage gekürzt, nicht vom Modell vergeben (ADR 0010,
     * „Konsequenzen"). Ein Titel je Fach vom Modell ist §15 in voller Form
     * und gehört zu Stufe 2 (T-02c).
     */
    title: text("title").notNull(),
    entryPoint: tutorEntryPoint("entry_point").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    // Anders als `calendar_event` (K-01, `restrict`): Ein Chatverlauf ist
    // kein Lernstand (ADR 0004 D6). Wird ein Fach gelöscht, dürfen seine
    // Tutor-Gespräche mitgehen – sie in den `deleteSubject()`-Riegel
    // aufzunehmen, hieße, den Verlauf von Hand aufräumen zu müssen, bevor
    // ein Fach weichen kann.
    foreignKey({
      name: "tutor_session_subject_fk",
      columns: [t.subjectId, t.studentId],
      foreignColumns: [subject.id, subject.studentId],
    }).onDelete("cascade"),
    // Zusammengesetzt gegen `(topic.id, topic.subject_id)`: Ein gesetztes
    // Thema muss zum Fach der Session gehören (§15 Fehler 2). `topic_id`
    // nullbar → MATCH SIMPLE prüft den Schlüssel nur, wenn er gesetzt ist.
    foreignKey({
      name: "tutor_session_topic_fk",
      columns: [t.topicId, t.subjectId],
      foreignColumns: [topic.id, topic.subjectId],
    }).onDelete("cascade"),
    unique("tutor_session_id_student_id_key").on(t.id, t.studentId),
  ],
);

// --- tutor_message -------------------------------------------------------

export const tutorMessage = pgTable(
  "tutor_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    role: tutorMessageRole("role").notNull(),
    content: text("content").notNull(),
    /**
     * Verbrauchte Token (Ein- + Ausgabe) des Modellaufrufs, der diese
     * Antwort erzeugt hat. Nur auf `role = 'tutor'` gesetzt. Dient der
     * Kostenübersicht, nicht dem Limit – das zählt Aufrufe, nicht Token
     * (S-03b, ADR 0010 D4).
     */
    tokenCount: integer("token_count"),
    /**
     * Ergebnis des nachträglichen Sprachwächter-Laufs (T-02a, ADR 0010 D3).
     * Nur auf `role = 'tutor'`. `false` heißt: Der Detektor hielt die Antwort
     * nicht für Deutsch (bzw. nicht für die Zielsprache des Fachs). Es wird
     * nichts weggeworfen – der Wert ist eine Messung, kein Torwächter.
     * `null`, solange der Lauf nicht stattgefunden hat (Nutzernachricht,
     * oder Stream abgebrochen).
     */
    languageOk: boolean("language_ok"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "tutor_message_session_fk",
      columns: [t.sessionId, t.studentId],
      foreignColumns: [tutorSession.id, tutorSession.studentId],
    }).onDelete("cascade"),
  ],
);

// --- ai_usage -----------------------------------------------------------
// Das Kostenkonto (S-03b, ADR 0010 D4): eine Zeile je Modellaufruf, RLS wie
// `tutor_message` (nur Kind). Das Limit ist eine `count(*)`-Abfrage über ein
// gleitendes Fenster; aufgeräumt wird beim Schreiben, nicht per Cron.

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    endpoint: aiEndpoint("endpoint").notNull(),
    /** Ein- + Ausgabe des Aufrufs, wenn bekannt. `null`, wenn der Aufruf vor der Antwort abbrach. */
    tokenCount: integer("token_count"),
    ...timestamps,
  },
  (t) => [foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade")],
);
