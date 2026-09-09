import { sql } from "drizzle-orm";

import type { Transaction } from "@/db/actor";

/**
 * Die id des aktiven Schuljahres im Actor-Kontext von `tx` (F-16a, ADR 0009).
 *
 * `null`, wenn keins existiert. Sollte nach F-16a nicht mehr vorkommen –
 * die Registrierung legt eins an (`registrieren/actions.ts`) –, kam aber vor
 * dem Deploy bei genau einem Kind vor (Produktivdatenbank, `Ingo`, selbst
 * registriert vor F-16a). Deshalb kein `not null`-Zwang hier: Ein harter
 * Fehler wäre unfreundlicher als die kontrollierte Fehlermeldung, die der
 * Aufrufer daraus macht.
 */
export async function activeSchoolYearId(
  tx: Transaction,
  studentId: string,
): Promise<string | null> {
  const [row] = await tx.execute<{ id: string }>(
    sql`select id from school_year where student_id = ${studentId} and status = 'aktiv'`,
  );
  return row?.id ?? null;
}
