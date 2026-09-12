"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { extractCalendarFromImage, type InlineImage } from "@/ai/client";
import { withActor, type Actor } from "@/db/actor";
import { pgTextArray } from "@/db/sql-array";
import { bucheNutzung, ergaenzeTokenzahl, pruefeUndZaehle } from "@/lib/ai/rate-limit";
import { loginStatus } from "@/lib/auth/actor";
import { classifyPhotoImportError } from "@/lib/vocab/photo";
import { csvToDrafts } from "@/lib/calendar/csv-import";
import { icsToDrafts } from "@/lib/calendar/ics-import";
import { xlsxToDrafts } from "@/lib/calendar/xlsx-import";
import { EVENT_TYPE_OPTIONS, type CalendarEventType } from "@/lib/calendar/upcoming";
import { extractedEventsToDrafts } from "@/lib/calendar/from-extraction";
import type { CalendarImportDraft } from "@/lib/calendar/import-draft";
import type { ExistingCalendarEvent } from "@/lib/calendar/reimport-match";
import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { ladeFaecherFuerZuordnung, type FachOption } from "@/lib/tutor/fach-zuordnung";

/**
 * Bild-Import Klausurplan (K-03, §6 M7, ADR 0016). Zusammen mit
 * `klausurplan-einlesen.tsx`/`review-liste.tsx` das, was aus K-02c wurde
 * (siehe docs/PLAN.md) – ein Arbeitsschritt statt zwei, damit von Anfang an
 * echte Fotos statt der Fixture durchlaufen.
 *
 * Beide Rollen dürfen importieren (ADR 0004 D4, wie der Rest von
 * `calendar_event`) – deshalb `requireActor()`, nicht `requireStudentActor()`.
 */

async function requireActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

export type FotoErgebnis =
  { ok: true; drafts: CalendarImportDraft[] } | { ok: false; fehler: string };

/**
 * Ein Foto einlesen (K-03). Ein Bild je Aufruf, aus demselben Grund wie bei
 * den Vokabeln/der Hausaufgabe: Der Client ruft mehrfach nacheinander auf und
 * zeigt „Bild 2 von 3" statt eines Spinners. Das Bild wird **nicht**
 * gespeichert.
 *
 * Rate-Limit wie beim Hausaufgaben-Foto (`pruefeUndZaehle(tx, "vision")`) –
 * beide sind Vision-Aufrufe mit demselben Budget (S-03c/d).
 */
export async function fotoZuKlausurplan(image: InlineImage): Promise<FotoErgebnis | null> {
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

    const faecher = await ladeFaecherFuerZuordnung(tx);
    const usageId = await bucheNutzung(tx, "vision");
    return { ok: true as const, faecher, usageId };
  });
  if (!vorarbeit.ok) return { ok: false, fehler: vorarbeit.fehler };

  try {
    const extraction = await extractCalendarFromImage(image, {
      faecher: vorarbeit.faecher.map((f) => f.name),
    });
    await withActor(actor, (tx) =>
      ergaenzeTokenzahl(tx, vorarbeit.usageId, extraction.inputTokens, extraction.outputTokens),
    );
    return { ok: true, drafts: extractedEventsToDrafts(extraction.extraction.events) };
  } catch (problem) {
    // Wie bei `addFromPhoto()`/`fotoZuAufgaben()`: der ursprüngliche Fehler
    // gehört ins Serverlog, nicht in die Oberfläche, und `JSON.stringify()`
    // verhindert eine eingeschleuste Logzeile (CodeQL `js/log-injection`).
    const { fehler, ursache } = classifyPhotoImportError(problem);
    console.error(JSON.stringify(`Klausurplan-Import gescheitert: ${ursache}`));
    return { ok: false, fehler };
  }
}

const MAX_DATEIGROESSE = 3 * 1024 * 1024; // 3 MB – ein Klausurplan-Export wiegt Kilobyte, nicht Megabyte

export type DateiErgebnis =
  { ok: true; drafts: CalendarImportDraft[]; fehler: string[] } | { ok: false; fehler: string };

/**
 * Datei-Import Klausurplan (K-04, ADR 0016 D4). Kein Modellaufruf, deshalb
 * auch kein Rate-Limit (das schützt nur Vision-/Tutor-Kosten) – dafür ein
 * schlichter Größendeckel gegen versehentlich falsche Uploads.
 *
 * `base64` trägt XLSX (Binärformat), `text` trägt CSV/ICS – der Client
 * entscheidet anhand der Dateiendung, was er schickt.
 */
export async function dateiZuKlausurplan(input: {
  name: string;
  text?: string;
  base64?: string;
}): Promise<DateiErgebnis | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const endung = input.name.toLowerCase().split(".").pop() ?? "";
  const groesse = input.base64
    ? Math.floor((input.base64.length * 3) / 4)
    : (input.text?.length ?? 0);
  if (groesse > MAX_DATEIGROESSE) {
    return { ok: false, fehler: "Die Datei ist zu groß (mehr als 3 MB)." };
  }

  const faecher = await withActor(actor, (tx) => ladeFaecherFuerZuordnung(tx));
  const namen = faecher.map((f) => f.name);

  if (endung === "xlsx") {
    if (!input.base64) return { ok: false, fehler: "Die Datei kam nicht vollständig an." };
    const { drafts, fehler } = await xlsxToDrafts(Buffer.from(input.base64, "base64"), namen);
    if (drafts.length === 0 && fehler.length > 0) return { ok: false, fehler: fehler[0]! };
    return { ok: true, drafts, fehler };
  }
  if (!input.text) return { ok: false, fehler: "Die Datei kam nicht vollständig an." };
  if (endung === "csv") {
    const { drafts, fehler } = csvToDrafts(input.text, namen);
    if (drafts.length === 0 && fehler.length > 0) return { ok: false, fehler: fehler[0]! };
    return { ok: true, drafts, fehler };
  }
  if (endung === "ics" || endung === "ical") {
    const { drafts, fehler } = icsToDrafts(input.text, namen);
    if (drafts.length === 0 && fehler.length > 0) return { ok: false, fehler: fehler[0]! };
    return { ok: true, drafts, fehler };
  }
  return { ok: false, fehler: "Diese Datei kennt tutr nicht – erlaubt sind CSV, XLSX und ICS." };
}

export type ReviewKontext = {
  schoolYearId: string;
  subjects: FachOption[];
  className: string | null;
  ownGroups: string[] | null;
  existingEvents: ExistingCalendarEvent[];
};

/**
 * Alles, was die Review-Liste zum Abgleichen braucht (K-03): die Fächer für
 * die Fach-Auswahl, `class_name`/`own_groups` fürs Einrichten des
 * Gruppenfilters (ADR 0016 D3) und die bestehenden Termine fürs
 * Re-Import-Matching (D8) – nur `geplant`, ein abgesagter Termin braucht
 * kein „entfallen" mehr.
 */
export async function ladeReviewKontext(): Promise<ReviewKontext | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [schoolYear] = await tx.execute<{
      id: string;
      class_name: string | null;
      own_groups: string[] | null;
    }>(sql`
      select id, class_name, own_groups from school_year
      where student_id = ${actor.studentId} and status = 'aktiv'`);
    if (!schoolYear) return null;

    const subjects = await ladeFaecherFuerZuordnung(tx);

    const existingEvents = await tx.execute<{
      id: string;
      subject_id: string;
      groups: string[] | null;
      date: string;
      title: string;
    }>(sql`
      select id, subject_id, groups, to_char(date, 'YYYY-MM-DD') as date, title
      from calendar_event
      where school_year_id = ${schoolYear.id} and status = 'geplant'`);

    return {
      schoolYearId: schoolYear.id,
      subjects,
      className: schoolYear.class_name,
      ownGroups: schoolYear.own_groups,
      existingEvents: existingEvents.map((r) => ({
        id: r.id,
        subjectId: r.subject_id,
        groups: r.groups,
        date: r.date,
        title: r.title,
      })),
    };
  });
}

/**
 * Ersteinrichtung des Gruppenfilters (ADR 0016 D3): Die im Import gesehenen
 * Tokens, die das Kind als „das bin ich auch" bestätigt hat, landen an
 * `school_year.own_groups`. Überschreibt einen bestehenden Wert bewusst nicht
 * additiv – wer die Einrichtung erneut durchläuft, sieht wieder eine
 * vorausgewählte, aber vollständig editierbare Liste (`suggestOwnGroups()`),
 * kein Anhängen an eine Liste, die er nicht mehr vor Augen hat.
 */
export async function speichereEigeneGruppen(tokens: string[]): Promise<boolean> {
  const actor = await requireActor();
  if (!actor) return false;

  // `pgTextArray()`, nicht `${tokens}` direkt – ein rohes JS-Array wird von
  // der `postgres`-Bibliothek beim rohen `sql`-Tag nicht als Postgres-Array
  // erkannt und scheitert an Postgres als „malformed array literal" (Fund
  // 12.9.2026, siehe `sql-array.ts`).
  await withActor(actor, (tx) =>
    tx.execute(sql`
      update school_year set own_groups = ${pgTextArray(tokens)}
      where student_id = ${actor.studentId} and status = 'aktiv'`),
  );
  return true;
}

const TYPES = new Set(EVENT_TYPE_OPTIONS.map((o) => o.value));

export type NeuerImportEintrag = {
  subjectId: string;
  type: CalendarEventType;
  title: string;
  date: string;
  groups: string[];
};

export type VerschobenerImportEintrag = {
  eventId: string;
  date: string;
};

export type UebernehmenErgebnis =
  { ok: true; angelegt: number; aktualisiert: number } | { ok: false; fehler: string };

/** ISO-Datum grob prüfen: Form `YYYY-MM-DD` und ein echtes Kalenderdatum. Wie in `../actions.ts`. */
function gueltigesDatum(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

/** Woher der Import kam – bestimmt `calendar_event.source` (K-02a/K-03/K-04, ADR 0016 D8). */
export type ImportQuelle = "bild" | "datei";

/**
 * Übernimmt die im Review-Screen bestätigten Zeilen (K-03/K-04, ADR 0016 D2):
 * neue Termine anlegen (mit `groups`/`source`), verschobene Termine auf ihr
 * neues Datum bringen. Läuft in **einer** Transaktion – entweder beides oder
 * nichts, sonst könnte ein halb übernommener Import verwirrender sein als
 * gar keiner.
 */
export async function uebernehmen(input: {
  quelle: ImportQuelle;
  neu: NeuerImportEintrag[];
  verschoben: VerschobenerImportEintrag[];
}): Promise<UebernehmenErgebnis | null> {
  const actor = await requireActor();
  if (!actor) return null;

  for (const eintrag of input.neu) {
    if (eintrag.title.trim().length < 2 || eintrag.title.length > 100) {
      return { ok: false, fehler: "Ein Titel ist leer oder zu lang." };
    }
    if (!TYPES.has(eintrag.type)) return { ok: false, fehler: "Eine Art ist ungültig." };
    if (!gueltigesDatum(eintrag.date)) return { ok: false, fehler: "Ein Datum ist ungültig." };
  }
  for (const eintrag of input.verschoben) {
    if (!gueltigesDatum(eintrag.date)) return { ok: false, fehler: "Ein Datum ist ungültig." };
  }

  const result = await withActor(actor, async (tx) => {
    const [schoolYear] = await tx.execute<{ id: string }>(sql`
      select id from school_year where student_id = ${actor.studentId} and status = 'aktiv'`);
    if (!schoolYear) {
      return { ok: false as const, fehler: "Für dieses Konto fehlt noch ein Schuljahr." };
    }

    try {
      for (const eintrag of input.neu) {
        // `pgTextArray()` statt `${eintrag.groups}` direkt – sonst dieselbe
        // Falle wie bei `speichereEigeneGruppen()` (siehe `sql-array.ts`).
        const groups = eintrag.groups.length > 0 ? pgTextArray(eintrag.groups) : sql`null`;
        await tx.execute(sql`
          insert into calendar_event
            (student_id, school_year_id, subject_id, type, title, date, groups, source)
          values
            (${actor.studentId}, ${schoolYear.id}, ${eintrag.subjectId}, ${eintrag.type},
             ${eintrag.title.trim()}, ${eintrag.date}, ${groups}, ${input.quelle})`);
      }
      for (const eintrag of input.verschoben) {
        await tx.execute(sql`
          update calendar_event set date = ${eintrag.date} where id = ${eintrag.eventId}`);
      }
      return {
        ok: true as const,
        angelegt: input.neu.length,
        aktualisiert: input.verschoben.length,
      };
    } catch (problem) {
      if (problem instanceof Error && problem.message.includes("calendar_event_subject_fk")) {
        return { ok: false as const, fehler: "Ein Fach passt nicht zu diesem Schuljahr." };
      }
      throw problem;
    }
  });

  revalidatePath("/pruefungen");
  return result;
}
