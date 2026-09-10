"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor, type Actor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import {
  EVENT_TYPE_OPTIONS,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/calendar/upcoming";
import { databaseConfigured } from "@/lib/env";
import { activeSchoolYearId } from "@/lib/school-year/active";

/**
 * Prüfungskalender (K-01, Konzept §6 M7).
 *
 * Die schmale Fassung: Termine von Hand. Import (K-02–K-04), Themen-
 * Verknüpfung (P-01), Lernplan und Note kommen später.
 *
 * RLS (ADR 0004 D4, Zeile `calendar_event`): **beide Rollen** lesen und
 * schreiben – ein Elternteil trägt genauso einen Termin ein wie das Kind.
 * Deshalb hier kein `requireStudentActor`, nur `requireActor`.
 *
 * Termine hängen am aktiven Schuljahr (ADR 0009): `activeSchoolYearId()`
 * liefert es, `loadCalendar()` zeigt nur dessen Termine.
 */

async function requireActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

export type CalendarSubject = { id: string; name: string };

export type CalendarData = {
  events: CalendarEvent[];
  subjects: CalendarSubject[];
};

/** Termine und wählbare Fächer des aktiven Schuljahres. `null` ohne Anmeldung/DB. */
export async function loadCalendar(): Promise<CalendarData | null> {
  const actor = await requireActor();
  if (!actor) return null;

  type EventRow = {
    id: string;
    subject_id: string;
    subject_name: string;
    type: CalendarEventType;
    title: string;
    date: string;
    status: "geplant" | "abgesagt";
  };

  return withActor(actor, async (tx) => {
    const events = await tx.execute<EventRow>(sql`
      select ce.id, ce.subject_id, s.name as subject_name, ce.type, ce.title,
             to_char(ce.date, 'YYYY-MM-DD') as date, ce.status
      from calendar_event ce
      join subject s on s.id = ce.subject_id
      join school_year sy on sy.id = ce.school_year_id and sy.status = 'aktiv'
      order by ce.date`);

    const subjects = await tx.execute<CalendarSubject>(sql`
      select s.id, s.name from subject s
      join school_year_subject sys on sys.subject_id = s.id
      join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
      order by s.name`);

    return {
      events: events.map((r) => ({
        id: r.id,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        type: r.type,
        title: r.title,
        date: r.date,
        status: r.status,
      })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
    };
  });
}

export type EventInput = {
  subjectId: string;
  type: string;
  title: string;
  date: string;
};

export type EventResult = { ok: true; id: string } | { ok: false; fehler: string };

const TYPES = new Set(EVENT_TYPE_OPTIONS.map((o) => o.value));

/** ISO-Datum grob prüfen: Form `YYYY-MM-DD` und ein echtes Kalenderdatum. */
function gueltigesDatum(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

function pruefeEingabe(
  input: EventInput,
): { fehler: string } | { title: string; type: CalendarEventType } {
  const title = input.title.trim();
  if (title.length < 2)
    return { fehler: "Bitte einen Titel mit mindestens zwei Zeichen eintragen." };
  if (title.length > 100) return { fehler: "Der Titel ist zu lang." };
  if (!TYPES.has(input.type as CalendarEventType)) return { fehler: "Bitte eine Art wählen." };
  if (!gueltigesDatum(input.date)) return { fehler: "Bitte ein gültiges Datum wählen." };
  return { title, type: input.type as CalendarEventType };
}

export async function createEvent(input: EventInput): Promise<EventResult | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const geprueft = pruefeEingabe(input);
  if ("fehler" in geprueft) return { ok: false, fehler: geprueft.fehler };

  const result = await withActor(actor, async (tx) => {
    const schoolYearId = await activeSchoolYearId(tx, actor.studentId);
    if (!schoolYearId) {
      return { ok: false as const, fehler: "Für dieses Konto fehlt noch ein Schuljahr." };
    }
    try {
      const [row] = await tx.execute<{ id: string }>(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date)
        values (${actor.studentId}, ${schoolYearId}, ${input.subjectId}, ${geprueft.type},
                ${geprueft.title}, ${input.date})
        returning id`);
      return { ok: true as const, id: row!.id };
    } catch (problem) {
      // Zusammengesetzter Fremdschlüssel: Fach passt nicht zum Konto/Jahr.
      if (problem instanceof Error && problem.message.includes("calendar_event_subject_fk")) {
        return { ok: false as const, fehler: "Dieses Fach gibt es in deinem Schuljahr nicht." };
      }
      throw problem;
    }
  });

  revalidatePath("/pruefungen");
  return result;
}

export async function updateEvent(eventId: string, input: EventInput): Promise<EventResult | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const geprueft = pruefeEingabe(input);
  if ("fehler" in geprueft) return { ok: false, fehler: geprueft.fehler };

  const result = await withActor(actor, async (tx) => {
    try {
      await tx.execute(sql`
        update calendar_event
        set subject_id = ${input.subjectId}, type = ${geprueft.type},
            title = ${geprueft.title}, date = ${input.date}
        where id = ${eventId}`);
      return { ok: true as const, id: eventId };
    } catch (problem) {
      if (problem instanceof Error && problem.message.includes("calendar_event_subject_fk")) {
        return { ok: false as const, fehler: "Dieses Fach gibt es in deinem Schuljahr nicht." };
      }
      throw problem;
    }
  });

  revalidatePath("/pruefungen");
  return result;
}

/** Absagen behält den Termin, nur der Status wechselt (§6 M7). */
export async function setEventStatus(
  eventId: string,
  status: "geplant" | "abgesagt",
): Promise<void> {
  const actor = await requireActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`update calendar_event set status = ${status} where id = ${eventId}`),
  );
  revalidatePath("/pruefungen");
}

/** Endgültig entfernen – „Löschen mit Rückfrage" (§6 M7). */
export async function deleteEvent(eventId: string): Promise<void> {
  const actor = await requireActor();
  if (!actor) return;

  await withActor(actor, (tx) => tx.execute(sql`delete from calendar_event where id = ${eventId}`));
  revalidatePath("/pruefungen");
}
