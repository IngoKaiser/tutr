import {
  boolean,
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
 * **Fachbindung (geändert durch [ADR 0013](../../../docs/adr/0013-tutor-beginnt-mit-dem-dialog.md)
 * D3):** `tutor_session.subjectId` ist seit T-13 **nullbar** – `null` heißt
 * „noch nicht einsortiert", nicht „ohne Fach". Der Tutor startet ohne
 * Fachwahl; eine Fach-Zuordnung (`lib/tutor/fach-zuordnung.ts`) ordnet die
 * erste Nachricht zu, oder das Kind wählt selbst über den Kontext-Chip nach.
 * Ohne Fach gilt die strengste Sprachregel (kein Zielsprachen-Zugeständnis,
 * ADR 0013 D5) – die spätere Schicht (§10) bleibt für so lange ebenfalls
 * unbestimmt. Der zusammengesetzte Fremdschlüssel gegen `(subject.id,
 * subject.student_id)` wirkt weiterhin, sobald ein Wert gesetzt ist –
 * `MATCH SIMPLE` (Postgres-Default für zusammengesetzte Fremdschlüssel)
 * prüft nur, wenn keine Schlüsselspalte `null` ist, genau wie bei `topicId`.
 *
 * `topicId` ist nullbar und bleibt in Stufe 1 leer (es gibt keine
 * Themen-Oberfläche, ADR 0010 D6); der zusammengesetzte Fremdschlüssel gegen
 * `(topic.id, topic.subject_id)` entsteht aber jetzt, damit ein Thema später
 * nur noch gesetzt werden muss und strukturell zum Fach der Session passen
 * **muss** (§15 Fehler 2).
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
    /** Nullbar seit T-13 (ADR 0013 D3) – `null` heißt „noch nicht einsortiert". */
    subjectId: uuid("subject_id"),
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

// --- homework_task ---------------------------------------------------------
// Hausaufgaben-Sitzung: die einzelnen Aufgaben (T-03, Konzept §4a).
//
// **Hier und nicht in einer eigenen Datei** (Stand bis T-03 PR 2: eigene
// Datei `homework.ts`): `tutor_message` unten muss auf `homework_task`
// verweisen können (welche Nachricht gehört zu welcher Aufgabe), und
// `homework_task` selbst verweist auf `tutor_session` – zwei Dateien hätten
// sich hier gegenseitig importiert. Drizzles `pgTable()` wertet seine
// Fremdschlüssel-Spalten beim Einlesen der Datei aus, ein Kreisimport hätte
// eine der beiden Tabellen mit einer noch nicht fertig definierten anderen
// Tabelle arbeiten lassen. Eine Datei löst das strukturell, nicht nur zufällig.
//
// Eine Aufgabe hängt an einer `tutor_session` mit `entry_point =
// 'hausaufgabe'` – das Gespräch ist schon da, hier kommt nur der Zustand je
// Aufgabe dazu.
//
// **Der Zustand gehört der App, nicht dem Modell.** Das ist der Kern von
// §4a und zugleich Bedingung 2 aus ADR 0011 D3: Wie viele Versuche
// dokumentiert sind (`attempts`) und welche Hinweisstufe erreicht ist
// (`hint_level`), entscheidet nicht das Gespräch, sondern diese Zeile. Der
// Systemprompt bekommt daraus vorgegeben, was er sagen darf – „nie zwei
// Stufen auf einmal" und „Lösung erst nach zwei Versuchen" sind damit
// Rechenregeln, keine Bitten (`src/lib/tutor/hint-ladder.ts`).
//
// **RLS: nur das Kind** – anders als in ADR 0004 D4 ursprünglich vorgesehen.
// Status, Versuche und Zeit sind Prozessdaten; ADR 0012 D3 hat sie dem Kind
// zugeschlagen. Eltern bekommen keine Policy.

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
     * „Weiß ich nicht" erhöht das hier **nicht** – siehe `zaehltAlsVersuch()`.
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

// --- tutor_session_summary -------------------------------------------------
// Der Zweizeiler nach Abschluss einer Hausaufgaben-Session (T-03, §4a
// „Ansicht"): „5 Aufgaben, 4 selbst gelöst, 1 mit Lösung – Ungleichungen
// üben wir morgen."
//
// **War laut ADR 0004 D4 für Eltern gedacht, ist es nach ADR 0012 D3
// nicht mehr.** „Eltern sehen, was gelernt wird – nicht, wie gut es
// läuft" schließt auch den Zweizeiler ein: Er verrät über die Zahl
// gezeigter Lösungen genau das Wie-gut, das ADR 0012 den Eltern entzieht.
// CLAUDE.md führt die Tabelle deshalb ausdrücklich in der Kein-Zugriff-
// Liste. Die Tabelle bleibt trotzdem – als Abschluss-Rückmeldung fürs
// Kind selbst (`ladeHausaufgabenListe()` zeigt sie über der Aufgabenliste,
// sobald jede Aufgabe abgeschlossen ist) und damit ein einmal erzeugter
// Satz bei jedem erneuten Öffnen derselbe bleibt, statt bei jedem Laden neu
// erfunden zu werden.
//
// Eine Zeile je Session (`unique` auf `session_id`) – `naechsterZug()`/
// `zustandNachVersuchUrteil()` bestimmen den Zustand je Aufgabe, hier
// zählt nur die fertige Bilanz (`lib/tutor/hausaufgabe-zusammenfassung.ts`
// `bilanziere()`), kein Nacherzählen des Dialogs.
//
// **RLS: nur das Kind**, dieselbe Richtung wie `homework_task`
// (`0080-homework.sql`).

export const tutorSessionSummary = pgTable(
  "tutor_session_summary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    /** Der fertige Zweizeiler, schon als ein Satz – keine Einzelfelder, die die Oberfläche wieder zusammensetzen müsste. */
    summary: text("summary").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    foreignKey({
      name: "tutor_session_summary_session_fk",
      columns: [t.sessionId, t.studentId],
      foreignColumns: [tutorSession.id, tutorSession.studentId],
    }).onDelete("cascade"),
    unique("tutor_session_summary_session_id_key").on(t.sessionId),
  ],
);

// --- tutor_message -------------------------------------------------------

export const tutorMessage = pgTable(
  "tutor_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    /**
     * Welcher Hausaufgabe diese Nachricht gehört (T-03 PR 2). `null` außerhalb
     * einer Hausaufgaben-Session. Nötig, weil **mehrere** Aufgaben dieselbe
     * `tutor_session` teilen (ein Foto, eine Liste, §4a Schritt 1) – ohne
     * diese Spalte ließe sich der Verlauf einer einzelnen Aufgabe nicht vom
     * Rest der Sitzung trennen.
     */
    taskId: uuid("task_id"),
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
    foreignKey({
      name: "tutor_message_task_fk",
      columns: [t.taskId, t.studentId],
      foreignColumns: [homeworkTask.id, homeworkTask.studentId],
    }).onDelete("cascade"),
  ],
);

// --- ai_usage -----------------------------------------------------------
// Das Kostenkonto (S-03b, ADR 0010 D4; in echtes Geld übersetzt S-03c): eine
// Zeile je Modellaufruf, RLS wie `tutor_message` (nur Kind). Das Limit ist
// eine `sum(...)`-Abfrage über ein gleitendes Fenster; aufgeräumt wird beim
// Schreiben, nicht per Cron.

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull(),
    endpoint: aiEndpoint("endpoint").notNull(),
    /**
     * Eingabe und Ausgabe **getrennt** (S-03c), nicht mehr als eine Summe:
     * Sonnet berechnet Ausgabe-Tokens fünfmal so teuer wie Eingabe-Tokens
     * (`lib/ai/rate-limit.ts`) – eine addierte Zahl ließe sich nicht mehr in
     * echtes Geld zurückrechnen. Beide `null`, wenn der Aufruf vor der
     * Antwort abbrach (dann zählt die Zeile 0 zum Kostendeckel, nicht die
     * tatsächlich schon verbrauchten Tokens – eine bekannte, kleine Lücke,
     * siehe Kommentar dort).
     */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    ...timestamps,
  },
  (t) => [foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade")],
);
