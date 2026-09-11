"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { extractHomeworkFromImage, type InlineImage } from "@/ai/client";
import { withActor, type Actor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { bucheNutzung, ergaenzeTokenzahl, pruefeUndZaehle } from "@/lib/ai/rate-limit";
import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { pruefeUndErzeugeAbschluss } from "@/lib/tutor/hausaufgabe-abschluss";
import { classifyHomeworkPhotoError } from "@/lib/tutor/hausaufgabe-foto";
import type { HomeworkStatus } from "@/lib/tutor/hint-ladder";

/**
 * Laden und Anlegen für den Hausaufgaben-Tutor (T-03 PR 2, §4a).
 *
 * Wie bei `../actions.ts`: Das **Senden** eines Tutor-Zugs läuft nicht hier,
 * sondern über `POST /api/tutor` – nur dort lässt sich die Antwort streamen
 * (ADR 0010 D1). Diese Datei deckt den Weg davor (Foto → Aufgabenliste) und
 * danach (Liste laden, überspringen).
 */

async function requireStudentActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor?.role === "student" ? actor : null;
}

/**
 * Legt die Hausaufgaben-Session an – noch ohne Aufgaben, die kommen erst mit
 * dem ersten eingelesenen Foto (`fotoZuAufgaben()`). Anders als der freie
 * Tutor-Chat (der die Session erst mit der ersten Frage anlegt) braucht die
 * Foto-Galerie schon vorher eine `session_id`, an die sie ihre Aufgaben
 * hängen kann – mehrere Fotos können zu derselben Session gehören
 * (§4a Schritt 1: eine Doppelseite).
 */
export async function starteHausaufgabe(subjectId: string): Promise<{ sessionId: string } | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [subject] = await tx.execute<{ name: string }>(sql`
      select s.name from subject s
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      where s.id = ${subjectId}`);
    if (!subject) return null;

    const [neu] = await tx.execute<{ id: string }>(sql`
      insert into tutor_session (student_id, subject_id, title, entry_point)
      values (app.student_id(), ${subjectId}, ${`Hausaufgaben – ${subject.name}`}, 'hausaufgabe')
      returning id`);
    return { sessionId: neu!.id };
  });
}

export type FotoErgebnis = { ok: true; erkannt: number } | { ok: false; fehler: string };

/**
 * Ein Foto einlesen und als Aufgaben anhängen (T-03, §4a Schritt 1).
 *
 * **Ein Bild je Aufruf**, aus demselben Grund wie `addFromPhoto()` bei den
 * Vokabeln: Der Client ruft mehrfach nacheinander auf und kann so „Bild 2
 * von 3" zeigen statt eines Spinners (CLAUDE.md). Das Bild wird **nicht**
 * gespeichert (wie bei V-03b) – es lebt nur für die Dauer dieses Aufrufs.
 *
 * `position` hängt hinten an: `coalesce(max(position), 0) + 1, + 2, …` in
 * einer einzigen Abfrage, damit ein zweites Foto zur selben Session die
 * Reihenfolge des ersten nicht durcheinanderbringt.
 */
export async function fotoZuAufgaben(
  sessionId: string,
  image: InlineImage,
): Promise<FotoErgebnis | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  if (!anthropicConfigured()) {
    return { ok: false, fehler: "Die Bilderkennung ist auf diesem Gerät nicht eingerichtet." };
  }
  if (!image.base64) {
    return { ok: false, fehler: "Das Bild kam nicht vollständig an. Versuch es noch einmal." };
  }

  const vorarbeit = await withActor(actor, async (tx) => {
    const limit = await pruefeUndZaehle(tx, "vision");
    if (!limit.erlaubt) return { ok: false as const, fehler: limit.nachricht };

    const [session] = await tx.execute<{ subject_name: string }>(sql`
      select s.name as subject_name from tutor_session ts
      join subject s on s.id = ts.subject_id
      where ts.id = ${sessionId} and ts.entry_point = 'hausaufgabe'`);
    if (!session) return { ok: false as const, fehler: "Diese Hausaufgabe gibt es nicht." };

    const usageId = await bucheNutzung(tx, "vision");
    return { ok: true as const, subjectName: session.subject_name, usageId };
  });
  if (!vorarbeit.ok) return { ok: false, fehler: vorarbeit.fehler };

  let tasks;
  try {
    const extraction = await extractHomeworkFromImage(image, {
      subjectName: vorarbeit.subjectName,
    });
    tasks = extraction.extraction.tasks;
    await withActor(actor, (tx) =>
      ergaenzeTokenzahl(tx, vorarbeit.usageId, extraction.inputTokens, extraction.outputTokens),
    );
  } catch (problem) {
    const { fehler, ursache } = classifyHomeworkPhotoError(problem);
    console.error(`Hausaufgaben-Foto gescheitert (Session ${sessionId}): ${ursache}`);
    return { ok: false, fehler };
  }

  if (tasks.length === 0) {
    return {
      ok: false,
      fehler: "Auf dem Bild waren keine Aufgaben zu erkennen. Vielleicht hilft ein näheres Foto.",
    };
  }

  await withActor(actor, async (tx) => {
    const [stand] = await tx.execute<{ naechste: number }>(
      sql`select coalesce(max(position), 0) + 1 as naechste from homework_task where session_id = ${sessionId}`,
    );
    let position = stand?.naechste ?? 1;
    for (const task of tasks) {
      await tx.execute(sql`
        insert into homework_task (student_id, session_id, position, label, prompt)
        values (app.student_id(), ${sessionId}, ${position}, ${task.label || null}, ${task.prompt})`);
      position++;
    }
  });

  revalidatePath(`/tutor/hausaufgabe/${sessionId}`);
  return { ok: true, erkannt: tasks.length };
}

export type AufgabeSummary = {
  id: string;
  position: number;
  label: string | null;
  prompt: string;
  status: HomeworkStatus;
};

export type HausaufgabenListe = {
  sessionId: string;
  subjectName: string;
  aufgaben: AufgabeSummary[];
  /** Der Zweizeiler (§4a), sobald jede Aufgabe abgeschlossen ist – sonst `null`. */
  zusammenfassung: string | null;
};

/** Die Aufgabenliste einer Hausaufgaben-Session. `null`, wenn es sie nicht (mehr) gibt (RLS). */
export async function ladeHausaufgabenListe(sessionId: string): Promise<HausaufgabenListe | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [session] = await tx.execute<{ subject_name: string }>(sql`
      select s.name as subject_name from tutor_session ts
      join subject s on s.id = ts.subject_id
      where ts.id = ${sessionId} and ts.entry_point = 'hausaufgabe'`);
    if (!session) return null;

    const aufgaben = await tx.execute<{
      id: string;
      position: number;
      label: string | null;
      prompt: string;
      status: HomeworkStatus;
    }>(sql`
      select id, position, label, prompt, status from homework_task
      where session_id = ${sessionId}
      order by position asc`);

    const [zusammenfassung] = await tx.execute<{ summary: string }>(
      sql`select summary from tutor_session_summary where session_id = ${sessionId}`,
    );

    return {
      sessionId,
      subjectName: session.subject_name,
      aufgaben,
      zusammenfassung: zusammenfassung?.summary ?? null,
    };
  });
}

export type TutorMessageView = {
  id: string;
  role: "nutzer" | "tutor";
  content: string;
};

export type AufgabeDetail = {
  sessionId: string;
  taskId: string;
  subjectName: string;
  label: string | null;
  prompt: string;
  status: HomeworkStatus;
  attempts: number;
  hintLevel: number;
  messages: TutorMessageView[];
};

/** Eine einzelne Aufgabe mit ihrem eigenen Verlauf (nicht dem der ganzen Session, T-03 PR 2). */
export async function ladeAufgabe(
  sessionId: string,
  taskId: string,
): Promise<AufgabeDetail | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [row] = await tx.execute<{
      label: string | null;
      prompt: string;
      status: HomeworkStatus;
      attempts: number;
      hint_level: number;
      subject_name: string;
    }>(sql`
      select ht.label, ht.prompt, ht.status, ht.attempts, ht.hint_level, s.name as subject_name
      from homework_task ht
      join tutor_session ts on ts.id = ht.session_id
      join subject s on s.id = ts.subject_id
      where ht.id = ${taskId} and ht.session_id = ${sessionId}`);
    if (!row) return null;

    const messages = await tx.execute<{
      id: string;
      role: "nutzer" | "tutor";
      content: string;
    }>(sql`
      select id, role, content from tutor_message
      where task_id = ${taskId}
      order by created_at asc, id asc`);

    return {
      sessionId,
      taskId,
      subjectName: row.subject_name,
      label: row.label,
      prompt: row.prompt,
      status: row.status,
      attempts: row.attempts,
      hintLevel: row.hint_level,
      messages,
    };
  });
}

export type AufgabeStand = { status: HomeworkStatus; attempts: number; hintLevel: number };

/** Nur der Zustand – wird nach jedem gesendeten Zug neu geladen, um die Anzeige (§4a „Ansicht") aufzufrischen. */
export async function ladeAufgabeStand(taskId: string): Promise<AufgabeStand | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [row] = await tx.execute<{
      status: HomeworkStatus;
      attempts: number;
      hint_level: number;
    }>(sql`select status, attempts, hint_level from homework_task where id = ${taskId}`);
    if (!row) return null;
    return { status: row.status, attempts: row.attempts, hintLevel: row.hint_level };
  });
}

/**
 * Eine Aufgabe überspringen. Wie eine gezeigte Lösung **kein** „gelöst" –
 * die Ansicht (§4a) unterscheidet „übersprungen" ausdrücklich als eigenen
 * Ausgang.
 */
export async function ueberspringeAufgabe(sessionId: string, taskId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`
      update homework_task
      set status = 'uebersprungen', finished_at = coalesce(finished_at, now())
      where id = ${taskId} and status not in ('geloest', 'loesung_gezeigt', 'uebersprungen')`),
  );

  await pruefeUndErzeugeAbschluss(actor, sessionId);
  revalidatePath(`/tutor/hausaufgabe/${sessionId}`);
}
