"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";
import { sortForReview, withDerivedUnsicher, type VocabRow } from "@/lib/vocab/review-list";

/**
 * Vokabeln ohne Set, je Fach (V-03d).
 *
 * Entsteht, wenn ein Set gelöscht wird: `deleteSet()` bewahrt die Vokabeln,
 * nur die Zuordnung fällt weg (V-03a, ADR 0007). Diese Ansicht ist der Weg
 * zurück zu ihnen – einem Set zuordnen, bearbeiten oder löschen. Kein
 * Import-Bereich: hier wird nichts Neues angelegt, nur aufgeräumt.
 *
 * Löschen entfernt die Vokabel **vollständig** (kaskadiert auf Karten und
 * Reviews) – anders als beim Set-Löschen. Wer eine Vokabel hier löscht, will
 * sie weghaben, nicht nur aus einem Set.
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

export type OrphanView = {
  subjectId: string;
  subjectName: string;
  items: VocabRow[];
  /** Sets desselben Fachs, denen sich eine Vokabel wieder zuordnen lässt. */
  sets: { id: string; title: string }[];
};

export async function loadOrphans(subjectId: string): Promise<OrphanView | null> {
  const actor = await requireActor();
  if (!actor) return null;

  type SubjectRow = { name: string };
  type ItemRow = {
    id: string;
    term: string;
    translation: string;
    recognition_uncertain: boolean;
    confirmed_at: string | null;
  };
  type SetRow = { id: string; title: string };

  return withActor(actor, async (tx) => {
    const [subject] = await tx.execute<SubjectRow>(
      sql`select name from subject where id = ${subjectId}`,
    );
    if (!subject) return null;

    const items = await tx.execute<ItemRow>(
      sql`select vi.id, vi.term, vi.translation, vi.recognition_uncertain, vi.confirmed_at
          from vocab_item vi
          where vi.subject_id = ${subjectId}
            and not exists (
              select 1 from vocab_set_item vsi where vsi.vocab_item_id = vi.id
            )`,
    );

    const sets = await tx.execute<SetRow>(
      sql`select vs.id, vs.title from vocab_set vs
          join school_year sy on sy.id = vs.school_year_id and sy.status = 'aktiv'
          where vs.subject_id = ${subjectId}
          order by vs.title`,
    );

    return {
      subjectId,
      subjectName: subject.name,
      items: sortForReview(withDerivedUnsicher(items)),
      sets: sets.map((s) => ({ id: s.id, title: s.title })),
    };
  });
}

/** Ordnet eine Waisen-Vokabel einem Set desselben Fachs zu – kein neuer Lernstand. */
export async function assignOrphanToSet(
  subjectId: string,
  itemId: string,
  setId: string,
): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, async (tx) => {
    // Fach beider Seiten aus dem Set holen – der zusammengesetzte
    // Fremdschlüssel auf `vocab_set_item` verlangt es (V-05, ADR 0008 D2),
    // und so kann eine Vokabel nicht in ein Set eines anderen Fachs geraten.
    const [set] = await tx.execute<{ subject_id: string }>(
      sql`select subject_id from vocab_set where id = ${setId}`,
    );
    if (!set) return;

    await tx.execute(
      sql`insert into vocab_set_item (student_id, vocab_set_id, vocab_item_id, subject_id)
          values (${actor.studentId}, ${setId}, ${itemId}, ${set.subject_id})
          on conflict (vocab_set_id, vocab_item_id) do nothing`,
    );
  });
  revalidatePath(`/faecher/vokabeln/ohne-set/${subjectId}`);
  revalidatePath(`/faecher/vokabeln/${setId}`);
  revalidatePath("/faecher/vokabeln");
}

export async function updateOrphan(
  subjectId: string,
  itemId: string,
  term: string,
  translation: string,
): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(
      // Wie in `[setId]/actions.ts`: Speichern heißt „ich hab draufgeschaut"
      // und setzt deshalb auch `confirmed_at` (V-09) – auch ohne inhaltliche
      // Änderung, die Felder stehen ja vorausgefüllt da. Ein eigener Knopf
      // „Passt so" dafür tat dasselbe und ist wieder raus (V-13).
      sql`update vocab_item
          set term = ${term.trim()}, translation = ${translation.trim()},
              recognition_uncertain = false, confirmed_at = now()
          where id = ${itemId}`,
    ),
  );
  revalidatePath(`/faecher/vokabeln/ohne-set/${subjectId}`);
  revalidatePath("/faecher/vokabeln");
}

export async function deleteOrphan(subjectId: string, itemId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) => tx.execute(sql`delete from vocab_item where id = ${itemId}`));
  revalidatePath(`/faecher/vokabeln/ohne-set/${subjectId}`);
  revalidatePath("/faecher/vokabeln");
}
