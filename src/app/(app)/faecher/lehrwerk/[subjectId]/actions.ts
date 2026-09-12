"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  extractTextbookFromImage,
  suggestTextbookViaWebSearch,
  type InlineImage,
} from "@/ai/client";
import { withActor, type Actor } from "@/db/actor";
import { bucheNutzung, ergaenzeTokenzahl, pruefeUndZaehle } from "@/lib/ai/rate-limit";
import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { activeSchoolYearId } from "@/lib/school-year/active";
import { classifyPhotoImportError } from "@/lib/vocab/photo";

/**
 * Lehrwerk pro Fach erfassen (L-01, §7/§10, ADR 0009 Nachtrag 12.9.2026).
 *
 * Beide Rollen dürfen lesen und schreiben (wie `subject`/`school_year`,
 * jetzt auch `school_year_textbook`) – deshalb `requireActor()`, nicht
 * `requireStudentActor()`.
 *
 * Zwei Erfassungswege teilen sich **eine** editierbare Kapitelliste danach
 * (Foto → Vision, Websuche → Structured Output mit dem Websuche-Tool) – das
 * deckt „manuell" mit ab: Wer nichts fotografiert oder sucht, öffnet dieselbe
 * Liste einfach leer. Beide Wege nutzen den Vision-Kostendeckel
 * (`pruefeUndZaehle(tx, "vision")`) wie Foto-Import anderswo im Projekt –
 * die Websuche bucht zusätzlich ihre Suchanfragen (`ergaenzeTokenzahl()`,
 * `lib/ai/rate-limit.ts`).
 */

async function requireActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

export type LehrwerkChapter = { titel: string; seiten: string | null; sequence: number };

export type ZugewiesenesLehrwerk = {
  textbookId: string;
  titel: string;
  verlag: string | null;
  jahrgangsstufe: number | null;
  /** `true`, wenn dieses Kind das Lehrwerk selbst angelegt hat – nur dann bearbeitbar. */
  eigenes: boolean;
  kapitel: LehrwerkChapter[];
};

export type LehrwerkKandidat = {
  textbookId: string;
  titel: string;
  verlag: string | null;
  jahrgangsstufe: number | null;
  kuratiert: boolean;
};

export type LehrwerkKontext = {
  subjectId: string;
  subjectName: string;
  zugewiesen: ZugewiesenesLehrwerk | null;
  /** Vorhandene Lehrwerke (kuratiert oder von diesem Kind selbst) zu diesem Fach – ohne KI zuordenbar. */
  kandidaten: LehrwerkKandidat[];
};

/** Alles für die Verwaltungsseite eines Fachs. `null`, wenn das Fach nicht (mehr) zum aktiven Schuljahr gehört. */
export async function ladeLehrwerkKontext(subjectId: string): Promise<LehrwerkKontext | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [subject] = await tx.execute<{ id: string; name: string }>(sql`
      select s.id, s.name from subject s
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      where s.id = ${subjectId}`);
    if (!subject) return null;

    const [zuweisung] = await tx.execute<{
      textbook_id: string;
      title: string;
      publisher: string | null;
      grade_level: number | null;
      eigenes: boolean;
    }>(sql`
      select t.id as textbook_id, t.title, t.publisher, t.grade_level, (t.student_id is not null) as eigenes
      from school_year_textbook syt
      join school_year sy on sy.id = syt.school_year_id and sy.status = 'aktiv'
      join textbook t on t.id = syt.textbook_id
      where syt.subject_id = ${subjectId}`);

    let kapitel: LehrwerkChapter[] = [];
    if (zuweisung) {
      kapitel = await tx.execute<LehrwerkChapter>(sql`
        select title as titel, pages as seiten, sequence
        from chapter where textbook_id = ${zuweisung.textbook_id}
        order by sequence asc`);
    }

    const kandidaten = await tx.execute<{
      textbook_id: string;
      title: string;
      publisher: string | null;
      grade_level: number | null;
      kuratiert: boolean;
    }>(sql`
      select id as textbook_id, title, publisher, grade_level, (student_id is null) as kuratiert
      from textbook
      where lower(subject) = lower(${subject.name})
      order by kuratiert desc, title asc`);

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      zugewiesen: zuweisung
        ? {
            textbookId: zuweisung.textbook_id,
            titel: zuweisung.title,
            verlag: zuweisung.publisher,
            jahrgangsstufe: zuweisung.grade_level,
            eigenes: zuweisung.eigenes,
            kapitel,
          }
        : null,
      kandidaten: kandidaten.map((k) => ({
        textbookId: k.textbook_id,
        titel: k.title,
        verlag: k.publisher,
        jahrgangsstufe: k.grade_level,
        kuratiert: k.kuratiert,
      })),
    };
  });
}

export type LehrwerkAktionErgebnis = { ok: true } | { ok: false; fehler: string };

/** Ein vorhandenes Lehrwerk (kuratiert oder eigen) diesem Fach im aktiven Schuljahr zuordnen – ohne KI. */
export async function ordneVorhandenesLehrwerkZu(
  subjectId: string,
  textbookId: string,
): Promise<LehrwerkAktionErgebnis | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const result = await withActor(actor, async (tx) => {
    const schoolYearId = await activeSchoolYearId(tx, actor.studentId);
    if (!schoolYearId) {
      return { ok: false as const, fehler: "Für dieses Konto fehlt noch ein Schuljahr." };
    }
    await tx.execute(sql`
      insert into school_year_textbook (student_id, school_year_id, subject_id, textbook_id)
      values (${actor.studentId}, ${schoolYearId}, ${subjectId}, ${textbookId})
      on conflict (school_year_id, subject_id) do update set textbook_id = excluded.textbook_id`);
    return { ok: true as const };
  });
  revalidatePath(`/faecher/lehrwerk/${subjectId}`);
  return result;
}

/** Die Zuordnung für dieses Fach im aktiven Schuljahr entfernen (das Lehrwerk selbst bleibt bestehen). */
export async function entferneZuordnung(subjectId: string): Promise<boolean> {
  const actor = await requireActor();
  if (!actor) return false;

  await withActor(actor, async (tx) => {
    const schoolYearId = await activeSchoolYearId(tx, actor.studentId);
    if (!schoolYearId) return;
    await tx.execute(sql`
      delete from school_year_textbook
      where school_year_id = ${schoolYearId} and subject_id = ${subjectId}`);
  });
  revalidatePath(`/faecher/lehrwerk/${subjectId}`);
  return true;
}

export type FotoErgebnis =
  | {
      ok: true;
      titel: string | null;
      verlag: string | null;
      jahrgangsstufe: number | null;
      kapitel: LehrwerkChapter[];
    }
  | { ok: false; fehler: string };

/**
 * Ein Foto des Inhaltsverzeichnisses einlesen. Ein Bild je Aufruf, wie beim
 * Klausurplan-/Vokabel-Foto – das Bild wird **nicht** gespeichert.
 */
export async function leseKapitelAusFoto(
  image: InlineImage,
  subjectName: string,
): Promise<FotoErgebnis | null> {
  const actor = await requireActor();
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
    const usageId = await bucheNutzung(tx, "vision");
    return { ok: true as const, usageId };
  });
  if (!vorarbeit.ok) return { ok: false, fehler: vorarbeit.fehler };

  try {
    const result = await extractTextbookFromImage(image, { fach: subjectName });
    await withActor(actor, (tx) =>
      ergaenzeTokenzahl(tx, vorarbeit.usageId, result.inputTokens, result.outputTokens),
    );
    return {
      ok: true,
      titel: result.extraction.titel,
      verlag: result.extraction.verlag,
      jahrgangsstufe: result.extraction.jahrgangsstufe,
      kapitel: result.extraction.kapitel,
    };
  } catch (problem) {
    const { fehler, ursache } = classifyPhotoImportError(problem);
    console.error(JSON.stringify(`Lehrwerk-Foto gescheitert: ${ursache}`));
    return { ok: false, fehler };
  }
}

export type SucheErgebnis =
  | {
      ok: true;
      gefunden: boolean;
      titel: string | null;
      verlag: string | null;
      jahrgangsstufe: number | null;
      kapitel: LehrwerkChapter[];
      quellen: string[];
      hinweis: string | null;
    }
  | { ok: false; fehler: string };

/** „Claude sucht das Lehrwerk im Internet" – ein ungefährer Titel + Fach rein, ein markierter Vorschlag raus. */
export async function sucheLehrwerkImInternet(
  titelHinweis: string,
  subjectName: string,
): Promise<SucheErgebnis | null> {
  const actor = await requireActor();
  if (!actor) return null;

  if (!anthropicConfigured()) {
    return { ok: false, fehler: "Die Websuche ist auf diesem Gerät nicht eingerichtet." };
  }
  const titel = titelHinweis.trim();
  if (titel.length < 2) {
    return { ok: false, fehler: "Bitte einen Titel oder ein Stichwort eingeben." };
  }

  const vorarbeit = await withActor(actor, async (tx) => {
    const limit = await pruefeUndZaehle(tx, "vision");
    if (!limit.erlaubt) return { ok: false as const, fehler: limit.nachricht };
    const usageId = await bucheNutzung(tx, "vision");
    return { ok: true as const, usageId };
  });
  if (!vorarbeit.ok) return { ok: false, fehler: vorarbeit.fehler };

  try {
    const result = await suggestTextbookViaWebSearch({ titelHinweis: titel, fach: subjectName });
    await withActor(actor, (tx) =>
      ergaenzeTokenzahl(
        tx,
        vorarbeit.usageId,
        result.inputTokens,
        result.outputTokens,
        result.searchRequests,
      ),
    );
    return {
      ok: true,
      gefunden: result.suggestion.gefunden,
      titel: result.suggestion.titel,
      verlag: result.suggestion.verlag,
      jahrgangsstufe: result.suggestion.jahrgangsstufe,
      kapitel: result.suggestion.kapitel,
      quellen: result.suggestion.quellen,
      hinweis: result.suggestion.hinweis,
    };
  } catch (problem) {
    const { fehler, ursache } = classifyPhotoImportError(problem);
    console.error(JSON.stringify(`Lehrwerk-Websuche gescheitert: ${ursache}`));
    return { ok: false, fehler };
  }
}

export type NeuesLehrwerkInput = {
  titel: string;
  verlag: string | null;
  jahrgangsstufe: number | null;
  quelle: "foto" | "claude_vorwissen";
  kapitel: LehrwerkChapter[];
};

function pruefeLehrwerkEingabe(input: NeuesLehrwerkInput): string | null {
  if (input.titel.trim().length < 2 || input.titel.trim().length > 120) {
    return "Der Titel ist leer oder zu lang.";
  }
  if (input.kapitel.some((k) => k.titel.trim().length === 0)) {
    return "Ein Kapiteltitel ist leer.";
  }
  return null;
}

/**
 * Ein neues Lehrwerk anlegen (mit Kapiteln) und dem Fach im aktiven
 * Schuljahr zuordnen – in einer Transaktion (wie `uebernehmen()` beim
 * Kalender-Import): entweder beides oder nichts.
 */
export async function speichereNeuesLehrwerk(
  subjectId: string,
  input: NeuesLehrwerkInput,
): Promise<LehrwerkAktionErgebnis | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const eingabeFehler = pruefeLehrwerkEingabe(input);
  if (eingabeFehler) return { ok: false, fehler: eingabeFehler };

  const result = await withActor(actor, async (tx) => {
    const [subject] = await tx.execute<{ id: string; name: string }>(sql`
      select s.id, s.name from subject s
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      where s.id = ${subjectId}`);
    if (!subject) return { ok: false as const, fehler: "Dieses Fach gibt es nicht (mehr)." };

    const schoolYearId = await activeSchoolYearId(tx, actor.studentId);
    if (!schoolYearId) {
      return { ok: false as const, fehler: "Für dieses Konto fehlt noch ein Schuljahr." };
    }

    const [neu] = await tx.execute<{ id: string }>(sql`
      insert into textbook (student_id, title, subject, grade_level, publisher, source)
      values
        (${actor.studentId}, ${input.titel.trim()}, ${subject.name}, ${input.jahrgangsstufe},
         ${input.verlag}, ${input.quelle})
      returning id`);
    for (const kapitel of input.kapitel) {
      await tx.execute(sql`
        insert into chapter (student_id, textbook_id, title, pages, sequence)
        values (${actor.studentId}, ${neu!.id}, ${kapitel.titel.trim()}, ${kapitel.seiten}, ${kapitel.sequence})`);
    }
    await tx.execute(sql`
      insert into school_year_textbook (student_id, school_year_id, subject_id, textbook_id)
      values (${actor.studentId}, ${schoolYearId}, ${subjectId}, ${neu!.id})
      on conflict (school_year_id, subject_id) do update set textbook_id = excluded.textbook_id`);

    return { ok: true as const };
  });
  revalidatePath(`/faecher/lehrwerk/${subjectId}`);
  return result;
}

/**
 * Titel, Verlag, Jahrgangsstufe und Kapitel eines **eigenen** Lehrwerks
 * überschreiben (Nachbearbeiten, z. B. einen Tippfehler oder ein
 * nachträglich fotografiertes Kapitel). Ein kuratiertes Lehrwerk lässt sich
 * so nicht ändern – die RLS-Policy (`textbook_write`) verlangt ohnehin
 * `student_id = app.student_id()`, die vorgelagerte Prüfung liefert nur die
 * deutsche Fehlermeldung dazu, statt eines rohen Datenbankfehlers.
 */
export async function aktualisiereEigenesLehrwerk(
  subjectId: string,
  textbookId: string,
  input: NeuesLehrwerkInput,
): Promise<LehrwerkAktionErgebnis | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const eingabeFehler = pruefeLehrwerkEingabe(input);
  if (eingabeFehler) return { ok: false, fehler: eingabeFehler };

  const result = await withActor(actor, async (tx) => {
    const [eigenes] = await tx.execute<{ id: string }>(sql`
      select id from textbook where id = ${textbookId} and student_id = app.student_id()`);
    if (!eigenes) {
      return {
        ok: false as const,
        fehler:
          "Ein kuratiertes Lehrwerk lässt sich nicht bearbeiten – leg stattdessen ein eigenes an.",
      };
    }

    await tx.execute(sql`
      update textbook
      set title = ${input.titel.trim()}, grade_level = ${input.jahrgangsstufe}, publisher = ${input.verlag}
      where id = ${textbookId}`);
    // Kapitel neu schreiben statt einzeln abzugleichen – dieselbe Idee wie
    // bei `speichereEigeneGruppen()`: eine vollständig ersetzte Liste ist
    // einfacher richtig zu halten als ein Diff aus Hinzufügen/Ändern/Löschen.
    await tx.execute(sql`delete from chapter where textbook_id = ${textbookId}`);
    for (const kapitel of input.kapitel) {
      await tx.execute(sql`
        insert into chapter (student_id, textbook_id, title, pages, sequence)
        values (${actor.studentId}, ${textbookId}, ${kapitel.titel.trim()}, ${kapitel.seiten}, ${kapitel.sequence})`);
    }
    return { ok: true as const };
  });
  revalidatePath(`/faecher/lehrwerk/${subjectId}`);
  return result;
}
