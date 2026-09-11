"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
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
  subjectName: string;
  updatedAt: string;
  /** `true` bei `entry_point = 'hausaufgabe'` (T-03 PR 2) – die Übersicht verlinkt dann auf `/tutor/hausaufgabe/<id>` statt auf den freien Chat. */
  hausaufgabe: boolean;
};

export type TutorOverview = {
  subjects: SubjectChoice[];
  sessions: SessionSummary[];
};

/** Fächer des aktiven Schuljahres und die bisherigen Gespräche. `null` ohne Kind-Anmeldung/DB. */
export async function loadTutorOverview(): Promise<TutorOverview | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const subjects = await tx.execute<{ id: string; name: string; language: string | null }>(sql`
      select s.id, s.name, s.language from subject s
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      order by s.name`);

    const sessions = await tx.execute<{
      id: string;
      title: string;
      subject_name: string;
      updated_at: string;
      entry_point: string;
    }>(sql`
      select ts.id, ts.title, s.name as subject_name, ts.updated_at, ts.entry_point
      from tutor_session ts
      join subject s on s.id = ts.subject_id
      order by ts.updated_at desc
      limit 20`);

    return {
      subjects: subjects.map((r) => ({ id: r.id, name: r.name, language: r.language })),
      sessions: sessions.map((r) => ({
        id: r.id,
        title: r.title,
        subjectName: r.subject_name,
        updatedAt: r.updated_at,
        hausaufgabe: r.entry_point === "hausaufgabe",
      })),
    };
  });
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
  subjectName: string;
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
    const [meta] = await tx.execute<{
      id: string;
      subject_name: string;
      subject_language: string | null;
      topic_title: string | null;
      entry_point: string;
    }>(sql`
      select ts.id, s.name as subject_name, s.language as subject_language,
             t.title as topic_title, ts.entry_point
      from tutor_session ts
      join subject s on s.id = ts.subject_id
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

/** Ein Gespräch samt Nachrichten löschen (kaskadiert). */
export async function deleteTutorSession(sessionId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`delete from tutor_session where id = ${sessionId}`),
  );
  revalidatePath("/tutor");
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
