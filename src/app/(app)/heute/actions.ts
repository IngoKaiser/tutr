"use server";

import { sql } from "drizzle-orm";

import { withActor, type Actor } from "@/db/actor";
import type { CalendarEventType } from "@/lib/calendar/upcoming";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";

/**
 * Datenzugriff für „Heute" (H-01, Konzept §5).
 *
 * Nur der nächste Termin steht hier. Die fälligen Karten holt „Heute" über
 * `loadDueBySubject()` aus `../ueben/actions` – dieselbe Zahl wie im
 * Üben-Bereich, aus derselben Abfrage. Zwei Wege zur selben Zahl wären zwei
 * Gelegenheiten, auseinanderzulaufen; auf einer Agenda-Seite, die den
 * Üben-Knopf beschriftet, wäre genau das der Fehler, der auffällt.
 *
 * Was §5 sonst noch für „Heute" vorsieht – Lernplan-Slot des Tages,
 * Fördern-/Fordern-Karte, Sommer-Assistent – steht hier **nicht**: Lernplan
 * (M7), Mastery (M1) und Schuljahr-Rollover (F-16b) gibt es noch nicht.
 * Erfundene Platzhalter daneben einer echten Zahl wären genau die Unwahrheit,
 * die §15 verbietet (dieselbe Linie wie `/ueben`).
 */

async function requireActor(): Promise<Actor | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

export type NaechsterTermin = {
  id: string;
  subjectName: string;
  type: CalendarEventType;
  title: string;
  /** ISO-Datum `YYYY-MM-DD`. */
  date: string;
};

/**
 * Der nächste geplante Termin des aktiven Schuljahres, oder `null`.
 *
 * `todayISO` kommt von der Seite, nicht aus `current_date`: Der Countdown
 * daneben rechnet mit `daysUntil()` in UTC (`lib/calendar/upcoming.ts`), und
 * ein zweites „heute" aus der Zeitzone des Datenbankservers könnte einen Tag
 * daneben liegen. Ein Stichtag, ein Ergebnis.
 *
 * Abgesagte Termine bleiben draußen (`status = 'geplant'`) – sie behalten
 * ihren Verlauf im Kalender (§6 M7), aber ankündigen muss man sie nicht mehr.
 */
export async function loadNaechstenTermin(todayISO: string): Promise<NaechsterTermin | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const [row] = await tx.execute<{
      id: string;
      subject_name: string;
      type: CalendarEventType;
      title: string;
      date: string;
    }>(sql`
      select ce.id, s.name as subject_name, ce.type, ce.title,
             to_char(ce.date, 'YYYY-MM-DD') as date
      from calendar_event ce
      join subject s on s.id = ce.subject_id
      join school_year sy on sy.id = ce.school_year_id and sy.status = 'aktiv'
      where ce.status = 'geplant' and ce.date >= ${todayISO}::date
      order by ce.date
      limit 1`);
    if (!row) return null;

    return {
      id: row.id,
      subjectName: row.subject_name,
      type: row.type,
      title: row.title,
      date: row.date,
    };
  });
}
