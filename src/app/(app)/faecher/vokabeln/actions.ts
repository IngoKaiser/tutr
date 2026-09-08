"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";

/**
 * Sets und Fächer für die Vokabelverwaltung (V-03a, ADR 0007).
 *
 * Der Actor kommt ausschließlich aus `loginStatus()` – wie überall sonst.
 * Vokabel-Policies (ADR 0004 D4): Kind schreibt, Eltern lesen. `loadSets()`
 * funktioniert deshalb für beide Rollen, Schreiben nur fürs Kind.
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

export type VocabSetSummary = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  itemCount: number;
};

/** Alle Sets, nach Fach sortiert. `null`, wenn nicht angemeldet oder ohne DB (CI-E2E). */
export async function loadSets(): Promise<VocabSetSummary[] | null> {
  const actor = await requireActor();
  if (!actor) return null;

  type Row = {
    id: string;
    title: string;
    subject_id: string;
    subject_name: string;
    item_count: string;
  };

  return withActor(actor, async (tx) => {
    const rows = await tx.execute<Row>(
      sql`select vs.id, vs.title, vs.subject_id, s.name as subject_name,
            count(vsi.id)::text as item_count
          from vocab_set vs
          join subject s on s.id = vs.subject_id
          left join vocab_set_item vsi on vsi.vocab_set_id = vs.id
          group by vs.id, vs.title, vs.subject_id, s.name
          order by s.name, vs.title`,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      itemCount: Number(r.item_count),
    }));
  });
}

export type SubjectOption = { id: string; name: string };

/** Fächer für den Set-Anlegen-Dialog. */
export async function loadSubjects(): Promise<SubjectOption[] | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, (tx) =>
    tx.execute<SubjectOption>(sql`select id, name from subject order by name`),
  );
}

export async function createSet(input: { subjectId: string; title: string }): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  const title = input.title.trim();
  if (!title) return;

  await withActor(actor, (tx) =>
    tx.execute(
      sql`insert into vocab_set (student_id, subject_id, title)
          values (${actor.studentId}, ${input.subjectId}, ${title})`,
    ),
  );
  revalidatePath("/faecher/vokabeln");
}

/**
 * Löscht nur das Set, nicht die Vokabeln darin: `vocab_set_item` kaskadiert,
 * `vocab_item` (und damit Karten und Lernstand) bleibt unberührt – eine
 * Vokabel kann in einem anderen Set stecken oder einfach erhalten bleiben.
 */
export async function deleteSet(setId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) => tx.execute(sql`delete from vocab_set where id = ${setId}`));
  revalidatePath("/faecher/vokabeln");
}
