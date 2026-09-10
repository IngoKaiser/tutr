import { sql } from "drizzle-orm";

import type { Transaction } from "@/db/actor";

/**
 * Kostendeckel für KI-Endpunkte (S-03b, ADR 0010 D4).
 *
 * Ab dem ersten Tutor-Klick löst jede Frage einen bezahlten Modellaufruf aus
 * (~1,1 ct je Antwort). Ohne Deckel ist ein festhängender Client oder ein
 * gelangweilter Nachmittag teurer als der gesamte übrige Betrieb.
 *
 * Der Zähler ist eine Zeile je Aufruf in `ai_usage` und die Prüfung eine
 * `count(*)`-Abfrage über ein gleitendes Fenster – kein Redis, keine neue
 * Abhängigkeit (ADR 0010 D4, „Abgelehnte Alternativen").
 *
 * Zwei Fenster, hergeleitet aus 1,1 ct je Antwort:
 * - **Stunde/20** fängt die Schleife ab (~22 ct Worst Case).
 * - **Tag/60** liegt über den ~40 Antworten/Tag aus Konzept §11, im Alltag
 *   also unsichtbar (~66 ct Worst Case).
 */

export const AI_LIMITS = {
  stunde: 20,
  tag: 60,
} as const;

/** Wie lange `ai_usage`-Zeilen aufbewahrt werden. Aufgeräumt wird beim Schreiben, nicht per Cron. */
const AUFBEWAHRUNG_TAGE = 7;

export type LimitEntscheidung = { erlaubt: true } | { erlaubt: false; nachricht: string };

/**
 * Reine Entscheidung aus zwei Zählständen – der testbare Kern.
 *
 * Die Nachricht sagt, **wann es weitergeht**, nicht „Rate limit exceeded":
 * Der Deckel ist ein Kostenschutz, kein pädagogisches Mittel, und darf nicht
 * wie eine Strafe klingen.
 */
export function pruefeLimit(zaehler: {
  letzteStunde: number;
  letzterTag: number;
}): LimitEntscheidung {
  if (zaehler.letzterTag >= AI_LIMITS.tag) {
    return {
      erlaubt: false,
      nachricht:
        "Für heute ist genug gefragt – der Tutor macht bis morgen Pause. Deine Vokabeln und Karten gehen weiter.",
    };
  }
  if (zaehler.letzteStunde >= AI_LIMITS.stunde) {
    return {
      erlaubt: false,
      nachricht:
        "Kurze Pause: In der nächsten Stunde geht es wieder. So lange kannst du üben oder lesen.",
    };
  }
  return { erlaubt: true };
}

/**
 * Zählt die Aufrufe des Kindes im Actor-Kontext von `tx` und entscheidet.
 * Räumt dabei alte Zeilen weg. Muss **vor** dem Modellaufruf laufen.
 */
export async function pruefeUndZaehle(
  tx: Transaction,
  endpoint: "tutor" | "vision",
): Promise<LimitEntscheidung> {
  await tx.execute(
    sql`delete from ai_usage where created_at < now() - make_interval(days => ${AUFBEWAHRUNG_TAGE})`,
  );

  const [row] = await tx.execute<{ letzte_stunde: string; letzter_tag: string }>(sql`
    select
      count(*) filter (where created_at > now() - interval '1 hour')::text as letzte_stunde,
      count(*) filter (where created_at > now() - interval '1 day')::text  as letzter_tag
    from ai_usage
    where student_id = app.student_id() and endpoint = ${endpoint}`);

  return pruefeLimit({
    letzteStunde: Number(row?.letzte_stunde ?? 0),
    letzterTag: Number(row?.letzter_tag ?? 0),
  });
}

/** Bucht einen Aufruf. Nach dem Streamende noch einmal aufrufen, um `tokenCount` nachzutragen. */
export async function bucheNutzung(
  tx: Transaction,
  endpoint: "tutor" | "vision",
  tokenCount: number | null,
): Promise<string> {
  const [row] = await tx.execute<{ id: string }>(sql`
    insert into ai_usage (student_id, endpoint, token_count)
    values (app.student_id(), ${endpoint}, ${tokenCount})
    returning id`);
  return row!.id;
}

/** Trägt die Tokenzahl nach, sobald der Stream fertig ist. */
export async function ergaenzeTokenzahl(
  tx: Transaction,
  usageId: string,
  tokenCount: number,
): Promise<void> {
  await tx.execute(sql`update ai_usage set token_count = ${tokenCount} where id = ${usageId}`);
}
