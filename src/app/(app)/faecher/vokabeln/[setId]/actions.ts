"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor, type Transaction } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { classifyDuplicate, type ExistingVocabItem } from "@/lib/vocab/duplicates";
import { databaseConfigured } from "@/lib/env";
import { newCardColumns } from "@/lib/vocab/fsrs";
import { parsePastedVocabulary } from "@/lib/vocab/paste";

/**
 * Die Vokabelliste eines Sets (V-03a, ADR 0007 D2–D4).
 *
 * „Unsicher" ist keine Spalte (ADR 0006 D7: was sich ableiten lässt, wird
 * nicht gespeichert): leeres Feld, oder gleiches Wort mit anderer
 * Übersetzung im selben Set – beides beim Lesen berechnet, nicht beim
 * Schreiben markiert.
 *
 * Eine Korrektur an Wort/Übersetzung rührt den Lernstand nicht an (D3) –
 * `updateItem()` fasst `card`/`review` nie an. Die dort genannte Ausnahme
 * (Wort und Übersetzung exakt vertauscht → Karten tauschen FSRS-Zustände)
 * ist bewusst nicht gebaut: ein schmaler Randfall, der die Korrektur wie
 * jede andere behandelt – der Lernstand bleibt einfach an der ursprünglichen
 * Richtung hängen, statt der Vokabel zu folgen.
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

export type VocabRow = {
  id: string;
  term: string;
  translation: string;
  unsicher: boolean;
};

export type SetDetail = {
  id: string;
  title: string;
  subjectName: string;
  items: VocabRow[];
};

/** Unsichere Zeilen zuerst (ADR 0007 D2 – „dahin gehört der Blick"), sonst alphabetisch. */
function sortForReview(items: VocabRow[]): VocabRow[] {
  return [...items].sort((a, b) => {
    if (a.unsicher !== b.unsicher) return a.unsicher ? -1 : 1;
    return a.term.localeCompare(b.term, "de");
  });
}

function withDerivedUnsicher(
  rows: { id: string; term: string; translation: string }[],
): VocabRow[] {
  const termCounts = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.term.trim().toLowerCase();
    const translations = termCounts.get(key) ?? new Set();
    translations.add(row.translation.trim().toLowerCase());
    termCounts.set(key, translations);
  }
  return rows.map((row) => {
    const key = row.term.trim().toLowerCase();
    const leer = row.term.trim() === "" || row.translation.trim() === "";
    const uneinig = (termCounts.get(key)?.size ?? 0) > 1;
    return { ...row, unsicher: leer || uneinig };
  });
}

export async function loadSetDetail(setId: string): Promise<SetDetail | null> {
  const actor = await requireActor();
  if (!actor) return null;

  type Row = { title: string; subject_name: string };
  type ItemRow = { id: string; term: string; translation: string };

  return withActor(actor, async (tx) => {
    const [set] = await tx.execute<Row>(
      sql`select vs.title, s.name as subject_name
          from vocab_set vs join subject s on s.id = vs.subject_id
          where vs.id = ${setId}`,
    );
    if (!set) return null;

    const items = await tx.execute<ItemRow>(
      sql`select vi.id, vi.term, vi.translation
          from vocab_set_item vsi
          join vocab_item vi on vi.id = vsi.vocab_item_id
          where vsi.vocab_set_id = ${setId}`,
    );

    return {
      id: setId,
      title: set.title,
      subjectName: set.subject_name,
      items: sortForReview(withDerivedUnsicher(items)),
    };
  });
}

/**
 * Legt eine neue Vokabel an: leeres Wort, zwei Karten (vorwärts/rückwärts,
 * frisch aus `newCardColumns()`) und die Set-Mitgliedschaft.
 *
 * `subjectId` kommt vom aufrufenden Set (V-05, ADR 0008 D1) – `vocab_item`
 * trägt es als eigene, nicht ableitbare Spalte, `vocab_set_item` trägt es
 * zusätzlich, damit sein zusammengesetzter Fremdschlüssel das Fach gegen
 * beide Seiten (Set und Vokabel) bindet.
 */
async function insertNewItem(
  tx: Transaction,
  studentId: string,
  setId: string,
  subjectId: string,
  term: string,
  translation: string,
): Promise<string> {
  const [item] = await tx.execute<{ id: string }>(
    sql`insert into vocab_item (student_id, subject_id, term, translation)
        values (${studentId}, ${subjectId}, ${term}, ${translation})
        returning id`,
  );
  await tx.execute(
    sql`insert into vocab_set_item (student_id, vocab_set_id, vocab_item_id, subject_id)
        values (${studentId}, ${setId}, ${item!.id}, ${subjectId})`,
  );

  for (const direction of ["vorwaerts", "rueckwaerts"] as const) {
    const columns = newCardColumns();
    await tx.execute(
      sql`insert into card (student_id, vocab_item_id, direction, fsrs_state, due_at, state)
          values (${studentId}, ${item!.id}, ${direction},
            ${JSON.stringify(columns.fsrsState)}::jsonb, ${columns.dueAt.toISOString()}, ${columns.state})`,
    );
  }
  return item!.id;
}

/** Verknüpft ein bereits vorhandenes Item mit diesem Set – kein neuer Lernstand. */
async function linkExistingItem(
  tx: Transaction,
  studentId: string,
  setId: string,
  subjectId: string,
  itemId: string,
): Promise<void> {
  await tx.execute(
    sql`insert into vocab_set_item (student_id, vocab_set_id, vocab_item_id, subject_id)
        values (${studentId}, ${setId}, ${itemId}, ${subjectId})
        on conflict (vocab_set_id, vocab_item_id) do nothing`,
  );
}

export type AddSummary = { neu: number; verknuepft: number; zuPruefen: number };

/**
 * Fügt Zeilen ein – aus dem Einfügefeld oder als eine manuelle Zeile.
 *
 * Duplikate werden über **Set-Grenzen hinweg** geprüft, aber nur **innerhalb
 * desselben Fachs** (ADR 0007 D4, gerahmt durch ADR 0008 D4). Existiert
 * „aller/gehen" schon in einem anderen Französisch-Set, soll das hier
 * verknüpfen statt verdoppeln – englisch `sport/Sport` und französisch
 * `sport/Sport` sind dagegen zwei Vokabeln mit zwei Lernständen.
 *
 * Seit V-05 (ADR 0008 D1) trägt `vocab_item` das Fach selbst statt es über
 * die Sets abzuleiten, in denen sie steckt – die Abfrage unten ist dadurch
 * ein einzelner Vergleich, kein Join mehr über `vocab_set_item`/`vocab_set`.
 * Das schließt auch die Lücke, die die alte Ableitung hatte: Eine Vokabel in
 * keinem Set (möglich seit `deleteSet()`) hat jetzt trotzdem ein Fach und
 * wird als Duplikat gefunden.
 */
async function addRows(
  actor: Actor,
  setId: string,
  rows: { term: string; translation: string; unsicher: boolean }[],
): Promise<AddSummary> {
  const summary: AddSummary = { neu: 0, verknuepft: 0, zuPruefen: 0 };
  if (rows.length === 0) return summary;

  await withActor(actor, async (tx) => {
    const [set] = await tx.execute<{ subject_id: string }>(
      sql`select subject_id from vocab_set where id = ${setId}`,
    );
    if (!set) return;
    const subjectId = set.subject_id;

    // Wächst während des Durchlaufs mit: Sonst würde dieselbe Zeile zweimal
    // im selben Einfügen zweimal angelegt – ein realistischer Fall, wenn ein
    // Wort auf der Buchseite in zwei Abschnitten steht.
    const existing = await tx.execute<ExistingVocabItem>(
      sql`select id, term, translation from vocab_item where subject_id = ${subjectId}`,
    );

    const merken = (id: string, term: string, translation: string) => {
      existing.push({ id, term, translation });
    };

    for (const row of rows) {
      if (row.unsicher) {
        // Kein Trennzeichen erkannt – als eigene Zeile anlegen, damit sie in
        // der Liste auftaucht und dort vervollständigt werden kann.
        const id = await insertNewItem(
          tx,
          actor.studentId,
          setId,
          subjectId,
          row.term,
          row.translation,
        );
        merken(id, row.term, row.translation);
        summary.zuPruefen++;
        continue;
      }

      const { classification, match } = classifyDuplicate(row, existing);
      if (classification === "exakt" && match) {
        await linkExistingItem(tx, actor.studentId, setId, subjectId, match.id);
        summary.verknuepft++;
      } else if (classification === "abweichend") {
        // Nicht automatisch zusammenführen (D4) – als eigene Zeile anlegen,
        // sie erscheint als "unsicher", weil sich das Wort in diesem Set
        // wiederholt, sobald beide im selben Set stehen.
        const id = await insertNewItem(
          tx,
          actor.studentId,
          setId,
          subjectId,
          row.term,
          row.translation,
        );
        merken(id, row.term, row.translation);
        summary.zuPruefen++;
      } else {
        const id = await insertNewItem(
          tx,
          actor.studentId,
          setId,
          subjectId,
          row.term,
          row.translation,
        );
        merken(id, row.term, row.translation);
        summary.neu++;
      }
    }
  });

  revalidatePath(`/faecher/vokabeln/${setId}`);
  revalidatePath("/faecher/vokabeln");
  return summary;
}

export async function addFromPaste(setId: string, text: string): Promise<AddSummary | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;
  return addRows(actor, setId, parsePastedVocabulary(text));
}

export async function addManualItem(
  setId: string,
  term: string,
  translation: string,
): Promise<AddSummary | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;
  const trimmedTerm = term.trim();
  if (!trimmedTerm) return null;
  return addRows(actor, setId, [
    { term: trimmedTerm, translation: translation.trim(), unsicher: false },
  ]);
}

/**
 * Bearbeiten an Ort und Stelle. Rührt `card`/`review` nie an (D3).
 *
 * `setId` dient nur dem Revalidieren des richtigen Pfads – die eigentliche
 * Berechtigung prüft die Policy über `student_id`, nicht über das Set. Ohne
 * ihn bliebe genau die Seite veraltet, auf der die Änderung passiert ist.
 */
export async function updateItem(
  setId: string,
  itemId: string,
  term: string,
  translation: string,
): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(
      sql`update vocab_item set term = ${term.trim()}, translation = ${translation.trim()}
          where id = ${itemId}`,
    ),
  );
  revalidatePath(`/faecher/vokabeln/${setId}`);
  revalidatePath("/faecher/vokabeln");
}

/**
 * Löscht die Vokabel vollständig (nicht nur die Set-Mitgliedschaft) – für
 * Zeilen, die gar keine Vokabel sind (D2: Seitenzahl, Überschrift, eine beim
 * Einfügen missglückte Zeile). Kaskadiert über `vocab_set_item`, `card`,
 * `review` (V-01) – bei einer Karikatur-Zeile ohne echten Lernstand kein
 * Verlust.
 */
export async function deleteItem(setId: string, itemId: string): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  await withActor(actor, (tx) => tx.execute(sql`delete from vocab_item where id = ${itemId}`));
  revalidatePath(`/faecher/vokabeln/${setId}`);
  revalidatePath("/faecher/vokabeln");
}
