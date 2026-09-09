"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";
import { activeSchoolYearId } from "@/lib/school-year/active";

/**
 * Fächerverwaltung (F-16a, ADR 0009 D1/D2).
 *
 * Vorher konnte nur ein Elternteil ein Fach anlegen (ADR 0004 D4) – ein Kind
 * ohne Elternkonto (ADR 0006 D1: „funktioniert ohne") kam dadurch nie zu
 * einem Fach. Die Policies erlauben jetzt beiden Rollen zu schreiben
 * (ADR 0009 D1); der Actor kommt wie überall ausschließlich aus
 * `loginStatus()`.
 *
 * Ein Fach ist zeitlos (ADR 0004 D6), die Zuordnung zu einem Schuljahr
 * jahresweise (`school_year_subject`, ADR 0009 D2) – `createSubject()`
 * schreibt deshalb immer beide Zeilen in einer Transaktion.
 */

async function requireActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

async function requireStudentActor(): Promise<Actor | null> {
  const actor = await requireActor();
  return actor?.role === "student" ? actor : null;
}

export type SubjectRow = { id: string; name: string; language: string | null };

/** Fächer des aktiven Schuljahres. `null`, wenn nicht angemeldet oder ohne DB (CI-E2E). */
export async function loadSubjects(): Promise<SubjectRow[] | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, (tx) =>
    tx.execute<SubjectRow>(sql`
      select s.id, s.name, s.language from subject s
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      order by s.name`),
  );
}

export type SubjectFormResult = { ok: true; id: string } | { ok: false; fehler: string };

function nameOderFehler(name: string): string | { fehler: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2)
    return { fehler: "Bitte einen Namen mit mindestens zwei Zeichen eintragen." };
  if (trimmed.length > 60) return { fehler: "Der Name ist zu lang." };
  return trimmed;
}

/** Legt ein Fach an und ordnet es sofort dem aktiven Schuljahr zu (ADR 0009 D2). */
export async function createSubject(input: {
  name: string;
  language: string | null;
}): Promise<SubjectFormResult | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  const name = nameOderFehler(input.name);
  if (typeof name !== "string") {
    revalidatePath("/faecher");
    return { ok: false, fehler: name.fehler };
  }
  const language = input.language?.trim() || null;

  const result = await withActor(actor, async (tx) => {
    const schoolYearId = await activeSchoolYearId(tx, actor.studentId);
    if (!schoolYearId) {
      // Sollte nach F-16a nicht vorkommen (jede Registrierung legt ein
      // Jahr an) – ein Konto von vor dem Deploy hätte sonst nichts, an das
      // sich das neue Fach hängen ließe.
      return {
        ok: false as const,
        fehler: "Für dieses Konto fehlt noch ein Schuljahr. Bitte meldet euch bei uns.",
      };
    }
    try {
      const [subject] = await tx.execute<{ id: string }>(sql`
        insert into subject (student_id, name, language)
        values (${actor.studentId}, ${name}, ${language})
        returning id`);
      await tx.execute(sql`
        insert into school_year_subject (student_id, school_year_id, subject_id)
        values (${actor.studentId}, ${schoolYearId}, ${subject!.id})`);
      return { ok: true as const, id: subject!.id };
    } catch (problem) {
      if (problem instanceof Error && problem.message.includes("subject_student_id_name_key")) {
        return { ok: false as const, fehler: `„${name}" gibt es schon.` };
      }
      throw problem;
    }
  });

  revalidatePath("/faecher");
  return result;
}

/** Name und Sprache ändern lässt den Lernstand unberührt – reine Beschriftung. */
export async function updateSubject(
  subjectId: string,
  input: { name: string; language: string | null },
): Promise<SubjectFormResult | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  const name = nameOderFehler(input.name);
  if (typeof name !== "string") return { ok: false, fehler: name.fehler };
  const language = input.language?.trim() || null;

  const result = await withActor(actor, async (tx) => {
    try {
      await tx.execute(
        sql`update subject set name = ${name}, language = ${language} where id = ${subjectId}`,
      );
      return { ok: true as const, id: subjectId };
    } catch (problem) {
      if (problem instanceof Error && problem.message.includes("subject_student_id_name_key")) {
        return { ok: false as const, fehler: `„${name}" gibt es schon.` };
      }
      throw problem;
    }
  });

  revalidatePath("/faecher");
  return result;
}

export type DeleteSubjectResult = { ok: true } | { ok: false; fehler: string };

/**
 * Löscht ein Fach nur, wenn nichts daran hängt (§15, dieselbe Linie wie das
 * Set-Löschen in V-03a). `topic.subject_id` kaskadiert, `vocab_set.subject_id`
 * steht auf `restrict` – ohne diesen Riegel bräche eins von beiden mit einer
 * harten Datenbankmeldung ab, das andere nähme Themen stillschweigend mit.
 */
export async function deleteSubject(subjectId: string): Promise<DeleteSubjectResult | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  const result = await withActor(actor, async (tx) => {
    const [counts] = await tx.execute<{ themen: string; sets: string }>(sql`
      select
        (select count(*) from topic where subject_id = ${subjectId})::text as themen,
        (select count(*) from vocab_set where subject_id = ${subjectId})::text as sets`);
    const themen = Number(counts?.themen ?? 0);
    const sets = Number(counts?.sets ?? 0);

    if (themen > 0 || sets > 0) {
      const teile: string[] = [];
      if (themen > 0) teile.push(themen === 1 ? "1 Thema" : `${themen} Themen`);
      if (sets > 0) teile.push(sets === 1 ? "1 Vokabelset" : `${sets} Vokabelsets`);
      return {
        ok: false as const,
        fehler: `Erst ${teile.join(" und ")} entfernen, dann lässt sich das Fach löschen.`,
      };
    }

    await tx.execute(sql`delete from subject where id = ${subjectId}`);
    return { ok: true as const };
  });

  revalidatePath("/faecher");
  revalidatePath("/faecher/vokabeln");
  return result;
}
