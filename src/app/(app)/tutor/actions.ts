"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor, type Transaction } from "@/db/actor";
import { ladeGesamtauslastung, type Auslastung } from "@/lib/ai/rate-limit";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";

/**
 * Laden und Aufräumen für den Tutor-Chat (T-02).
 *
 * Das **Senden** einer Frage läuft nicht hier, sondern über den Route
 * Handler `POST /api/tutor` – nur dort lässt sich die Antwort streamen
 * (ADR 0010 D1). Diese Datei liest den Verlauf und löscht Gespräche.
 *
 * RLS (ADR 0004 D4): nur das Kind. Ein Elternteil bekommt `null` – für den
 * Tutor gibt es keine Elternsicht (ADR 0010 D2).
 */

async function requireStudentActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor?.role === "student" ? actor : null;
}

export type SubjectChoice = { id: string; name: string; language: string | null };

export type SessionSummary = {
  id: string;
  title: string;
  /** `null` heißt „noch nicht einsortiert" (ADR 0013 D3) – die Historie gruppiert das eigens (D6). */
  subjectName: string | null;
  updatedAt: string;
  /** `true` bei `entry_point = 'hausaufgabe'` (T-03 PR 2) – die Übersicht verlinkt dann auf `/tutor/hausaufgabe/<id>` statt auf den freien Chat. */
  hausaufgabe: boolean;
};

export type TutorOverview = {
  subjects: SubjectChoice[];
  sessions: SessionSummary[];
  /**
   * Wie viele Gespräche es insgesamt gibt (ADR 0014 D3) – `sessions` zeigt
   * auf `/tutor` nur die letzten `ZULETZT_ANZAHL`. Die Startseite braucht die
   * Zahl, um den Weg ins Archiv **nur dann** anzubieten, wenn dort mehr steht
   * als hier: Ein Link auf „alles" neben einer Liste, die schon alles ist,
   * wäre ein Versprechen auf nichts.
   */
  gesamt: number;
};

/**
 * So viele Gespräche stehen auf `/tutor` (ADR 0014 D3).
 *
 * Kurz genug, dass das Eingabefeld – das eigentliche Hauptelement der Seite
 * (ADR 0013 D1) – nicht nach unten rutscht. Der Rest steht im Archiv.
 *
 * Nicht exportiert: In einer `"use server"`-Datei darf **jeder** Export eine
 * asynchrone Funktion sein, sonst bricht der Build. Die Oberfläche braucht
 * die Zahl auch nicht – sie vergleicht `gesamt` mit dem, was sie bekommen hat.
 */
const ZULETZT_ANZAHL = 6;

/** Eine Obergrenze fürs Archiv, damit auch ein Schuljahr voller Gespräche eine endliche Abfrage bleibt. */
const ARCHIV_ANZAHL = 500;

type SessionRow = {
  id: string;
  title: string;
  subject_name: string | null;
  updated_at: string;
  entry_point: string;
};

/** Die immer gleiche Abfrage; `limit` ist der einzige Unterschied zwischen Startseite und Archiv. */
async function ladeSessions(tx: Transaction, limit: number): Promise<SessionSummary[]> {
  // `left join`, nicht `join`: Ein Gespräch ohne Fach (ADR 0013 D3) darf in
  // der Historie nicht einfach fehlen.
  const rows = await tx.execute<SessionRow>(sql`
    select ts.id, ts.title, s.name as subject_name, ts.updated_at, ts.entry_point
    from tutor_session ts
    left join subject s on s.id = ts.subject_id
    order by ts.updated_at desc
    limit ${limit}`);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subjectName: r.subject_name,
    updatedAt: r.updated_at,
    hausaufgabe: r.entry_point === "hausaufgabe",
  }));
}

async function ladeFaecher(tx: Transaction): Promise<SubjectChoice[]> {
  const rows = await tx.execute<{ id: string; name: string; language: string | null }>(sql`
    select s.id, s.name, s.language from subject s
    join school_year_subject sys on sys.subject_id = s.id
    join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
    order by s.name`);
  return rows.map((r) => ({ id: r.id, name: r.name, language: r.language }));
}

/**
 * Fächer des aktiven Schuljahres und die zuletzt geführten Gespräche.
 * `null` ohne Kind-Anmeldung/DB.
 */
export async function loadTutorOverview(): Promise<TutorOverview | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [subjects, sessions, anzahl] = await Promise.all([
      ladeFaecher(tx),
      ladeSessions(tx, ZULETZT_ANZAHL),
      tx.execute<{ anzahl: number }>(sql`select count(*)::int as anzahl from tutor_session`),
    ]);

    return { subjects, sessions, gesamt: anzahl[0]?.anzahl ?? sessions.length };
  });
}

/**
 * Die volle Liste für `/tutor/gespraeche` (ADR 0014 D3).
 *
 * Alles auf einmal statt seitenweise: Gesucht wird im Browser über die Titel,
 * und eine Suche, die nur die geladene Seite durchsieht, findet das Falsche.
 * Bei `ARCHIV_ANZAHL` Zeilen à Titel und Datum ist das eine überschaubare
 * Menge – wird es das nicht mehr, ist das der Moment für T-19d.
 */
export async function loadAlleGespraeche(): Promise<SessionSummary[] | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;
  return withActor(actor, (tx) => ladeSessions(tx, ARCHIV_ANZAHL));
}

export type TutorMessageView = {
  id: string;
  role: "nutzer" | "tutor";
  content: string;
  /** `false` = der Sprachwächter hielt die Antwort nicht für deutsch (nur bei `tutor`). */
  languageOk: boolean | null;
};

export type SessionView = {
  id: string;
  /** `null`, solange die Session keinem Fach zugeordnet ist (ADR 0013 D3). */
  subjectId: string | null;
  subjectName: string | null;
  subjectLanguage: string | null;
  topicTitle: string | null;
  entryPoint: "freie_frage" | "verstehen" | string;
  messages: TutorMessageView[];
};

/** Ein Gespräch mit allen Nachrichten. `null`, wenn es das Kind nicht hat (RLS). */
export async function loadSession(sessionId: string): Promise<SessionView | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    // `left join`, nicht `join`: Ein Gespräch ohne Fach (ADR 0013 D3) gäbe
    // es sonst hier nicht – die Seite meldete fälschlich „gibt es nicht".
    const [meta] = await tx.execute<{
      id: string;
      subject_id: string | null;
      subject_name: string | null;
      subject_language: string | null;
      topic_title: string | null;
      entry_point: string;
    }>(sql`
      select ts.id, ts.subject_id, s.name as subject_name, s.language as subject_language,
             t.title as topic_title, ts.entry_point
      from tutor_session ts
      left join subject s on s.id = ts.subject_id
      left join topic t on t.id = ts.topic_id
      where ts.id = ${sessionId}`);
    if (!meta) return null;

    const messages = await tx.execute<{
      id: string;
      role: "nutzer" | "tutor";
      content: string;
      language_ok: boolean | null;
    }>(sql`
      select id, role, content, language_ok
      from tutor_message
      where session_id = ${sessionId}
      order by created_at asc, id asc`);

    return {
      id: meta.id,
      subjectId: meta.subject_id,
      subjectName: meta.subject_name,
      subjectLanguage: meta.subject_language,
      topicTitle: meta.topic_title,
      entryPoint: meta.entry_point,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        languageOk: m.language_ok,
      })),
    };
  });
}

/**
 * Ordnet ein Gespräch von Hand einem Fach zu (T-13, ADR 0013 D4) – über den
 * antippbaren Kontext-Chip, egal ob er gerade „Fach wählen" zeigt (nach
 * „unklar") oder einen Namen, der geändert werden soll.
 *
 * Kein eigener „Fach entfernen"-Weg: Die Fach-Zuordnung schlägt höchstens auf
 * `null` fehl (D2), nie zurück von einem gesetzten Fach – wer eins gewählt
 * hat, wollte selten wieder keins.
 */
export async function waehleFach(sessionId: string, subjectId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`update tutor_session set subject_id = ${subjectId} where id = ${sessionId}`),
  );
  revalidatePath(`/tutor/${sessionId}`);
  revalidatePath("/tutor");
}

/** Ein Gespräch samt Nachrichten löschen (kaskadiert). */
export async function deleteTutorSession(sessionId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`delete from tutor_session where id = ${sessionId}`),
  );
  revalidatePath("/tutor");
  revalidatePath("/tutor/gespraeche");
}

/**
 * Der Auslastungs-Stand für den Pegel im Composer (S-03e).
 *
 * Eigene, schmale Action statt eines Feldes in `loadTutorOverview()`: Der
 * Composer frischt sie **nach jeder Antwort** auf, nicht nur beim Laden der
 * Seite. Sonst zeigte der Pegel bis zum nächsten Seitenaufruf den Stand von
 * vorhin – ausgerechnet nach einer langen Antwort, die ihn am stärksten
 * bewegt hat.
 */
export async function ladeAuslastung(): Promise<Auslastung | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;
  return withActor(actor, (tx) => ladeGesamtauslastung(tx));
}
