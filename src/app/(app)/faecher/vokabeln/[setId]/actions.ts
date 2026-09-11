"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { extractVocabularyFromImage } from "@/ai/client";
import { withActor, type Actor, type Transaction } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { classifyDuplicate, type ExistingVocabItem } from "@/lib/vocab/duplicates";
import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { newCardColumns } from "@/lib/vocab/fsrs";
import { parsePastedVocabulary } from "@/lib/vocab/paste";
import { classifyPhotoImportError, extractedRowsToPastedRows } from "@/lib/vocab/photo";
import { sortForReview, withDerivedUnsicher, type VocabRow } from "@/lib/vocab/review-list";

export type { VocabRow };

/**
 * Die Vokabelliste eines Sets (V-03a, ADR 0007 D2–D4).
 *
 * „Unsicher" ist **fast** keine Spalte (ADR 0006 D7: was sich ableiten
 * lässt, wird nicht gespeichert). Zwei der drei Gründe aus ADR 0007 D2
 * werden beim Lesen berechnet – leeres Feld, gleiches Wort mit anderer
 * Übersetzung im selben Set. Der dritte, niedrige Konfidenz der
 * Bilderkennung, steht als `recognition_uncertain` an `vocab_item`: Er ist
 * nicht ableitbar, sondern eine Tatsache aus dem Moment des Imports
 * (V-03b). Siehe `withDerivedUnsicher()`.
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

export type SetDetail = {
  id: string;
  title: string;
  subjectName: string;
  items: VocabRow[];
};

export async function loadSetDetail(setId: string): Promise<SetDetail | null> {
  const actor = await requireActor();
  if (!actor) return null;

  type Row = { title: string; subject_name: string };
  type ItemRow = {
    id: string;
    term: string;
    translation: string;
    recognition_uncertain: boolean;
    confirmed_at: string | null;
  };

  return withActor(actor, async (tx) => {
    const [set] = await tx.execute<Row>(
      sql`select vs.title, s.name as subject_name
          from vocab_set vs join subject s on s.id = vs.subject_id
          where vs.id = ${setId}`,
    );
    if (!set) return null;

    const items = await tx.execute<ItemRow>(
      sql`select vi.id, vi.term, vi.translation, vi.recognition_uncertain, vi.confirmed_at
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
  recognitionUncertain: boolean,
): Promise<string> {
  const [item] = await tx.execute<{ id: string }>(
    sql`insert into vocab_item (student_id, subject_id, term, translation, recognition_uncertain)
        values (${studentId}, ${subjectId}, ${term}, ${translation}, ${recognitionUncertain})
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
          row.unsicher,
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
          row.unsicher,
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
          row.unsicher,
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

export type PhotoImportResult =
  { ok: true; summary: AddSummary; erkannt: number } | { ok: false; fehler: string };

/**
 * Ein Foto einlesen (V-03b, ADR 0007 D1/D6).
 *
 * **Ein Bild je Aufruf, absichtlich.** Mehrere Fotos schickt der Client
 * nacheinander – nur so kann er „Bild 2 von 3" anzeigen und meinen, was er
 * sagt (CLAUDE.md: benannte, wahre Schritte statt Spinner). Ein Aufruf über
 * alle Bilder könnte nur einen Spinner zeigen.
 *
 * **Das Bild wird nirgends gespeichert** (D6): kein Storage, keine Spalte,
 * keine Datei. Es lebt für die Dauer dieses Aufrufs im Speicher und ist
 * danach fort. Deshalb steht hier auch kein Logging des Inhalts.
 *
 * Das Fach kommt aus dem Set – der Prompt braucht es, um „links steht die
 * Fremdsprache" nicht raten zu müssen.
 *
 * Der Rückgabewert ist bewusst ein Ergebnis-Typ statt eines geworfenen
 * Fehlers: Ein abgelehnter Bildtyp oder eine ausgefallene Erkennung ist für
 * die Nutzerin ein normaler Ausgang, kein Absturz, und die Oberfläche soll
 * einen deutschen Satz zeigen können.
 */
export async function addFromPhoto(
  setId: string,
  image: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<PhotoImportResult | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  if (!anthropicConfigured()) {
    return { ok: false, fehler: "Die Bilderkennung ist auf diesem Gerät nicht eingerichtet." };
  }
  if (!image.base64) {
    return { ok: false, fehler: "Das Bild kam nicht vollständig an. Versuch es noch einmal." };
  }

  const subjectName = await withActor(actor, async (tx) => {
    const [row] = await tx.execute<{ name: string }>(
      sql`select s.name from vocab_set vs join subject s on s.id = vs.subject_id
          where vs.id = ${setId}`,
    );
    return row?.name ?? null;
  });
  if (!subjectName) {
    return { ok: false, fehler: "Dieses Set gibt es nicht mehr." };
  }

  let rows;
  try {
    const extraction = await extractVocabularyFromImage(image, { subjectName });
    rows = extractedRowsToPastedRows(extraction.rows);
  } catch (problem) {
    // Der ursprüngliche Fehler kann Bild- oder Schlüsseldetails tragen – er
    // gehört ins Serverlog, nicht in die Oberfläche (V-03c). Vorher stand
    // hier ein `catch {}` ohne Bindung: Der Fehler war weg, sobald er
    // auftrat, und ein zur Hälfte gescheiterter Import ließ sich im
    // Nachhinein nicht mehr erklären.
    const { fehler, ursache } = classifyPhotoImportError(problem);
    // `setId` kommt roh aus der Anfrage, `ursache` kann bei einem
    // unerwarteten Fehler `error.message` enthalten – beides ungeprüft in
    // ein Serverlog zu schreiben, ließe einen Zeilenumbruch darin eine
    // gefälschte Logzeile einschleusen (CodeQL `js/log-injection`).
    // `JSON.stringify()`: CodeQLs `LogInjectionQuery.qll` erkennt als
    // Schranke entweder `String#replace(/\n/g, "")` wörtlich in genau dieser
    // Form oder `JSON.stringify()` – Letzteres escaped zusätzlich
    // Anführungszeichen und andere Steuerzeichen, nicht nur Zeilenumbrüche.
    console.error(JSON.stringify(`Foto-Import gescheitert (Set ${setId}): ${ursache}`));
    return { ok: false, fehler };
  }

  if (rows.length === 0) {
    return {
      ok: false,
      fehler: "Auf dem Bild waren keine Vokabeln zu erkennen. Vielleicht hilft ein näheres Foto.",
    };
  }

  const summary = await addRows(actor, setId, rows);
  return { ok: true, summary, erkannt: rows.length };
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
      // `recognition_uncertain` fällt beim Bearbeiten weg: Wer die Zeile
      // aufgeklappt und gespeichert hat, hat daraufgeschaut – und genau das
      // war der Zweck der Markierung (V-03b, ADR 0007 D2). Seit V-09 setzt
      // dasselbe Speichern auch `confirmed_at`: Es beantwortet die Frage
      // „stimmt das?" – ohne das bliebe eine korrigierte Doppel-Zeile
      // (`pasar`) weiter markiert und vom Üben ausgeschlossen (V-09). Die
      // Felder stehen vorausgefüllt da: Auch ohne inhaltliche Änderung heißt
      // „Speichern" auf eine unveränderte Zeile bereits „passt so" – ein
      // eigener zweiter Knopf dafür tat exakt dasselbe und ist wieder raus
      // (V-13). Der Lernstand bleibt unberührt, `card`/`review` fasst diese
      // Abfrage nicht an.
      sql`update vocab_item
          set term = ${term.trim()}, translation = ${translation.trim()},
              recognition_uncertain = false, confirmed_at = now()
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
