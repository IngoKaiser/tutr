import { sql } from "drizzle-orm";

import { getDb } from "./index";

/**
 * Wer stellt die Anfrage. Eltern sehen die ganze Familie, ein Kind nur sich
 * selbst – deshalb trägt nur die Schülerin eine `studentId`.
 * Siehe docs/adr/0004-datenmodell-rls.md (D1, D4).
 */
export type Actor =
  | { role: "parent"; familyId: string; userId: string }
  | { role: "student"; familyId: string; studentId: string };

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Führt `fn` in einer Transaktion aus, in der Postgres weiß, wer fragt.
 *
 * Zwei Sicherungen übereinander:
 * 1. Die Verbindung läuft bereits als `tutr_app` (NOBYPASSRLS) – ohne diesen
 *    Aufruf wären die Session-Variablen leer und jede Policy falsch, also
 *    liefert eine vergessene Umhüllung ein leeres Resultat, keinen Fremdzugriff.
 * 2. `set local role` fängt den Fall ab, dass doch einmal eine Verbindung mit
 *    stärkeren Rechten in die Laufzeit gerät.
 *
 * `SET LOCAL` (nicht `SET`) ist im Transaction-Pooling-Modus zwingend – nur so
 * gehört die Einstellung zur Transaktion und nicht zur wiederverwendeten Session.
 */
export async function runWithActor<T>(
  database: Database,
  actor: Actor,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`set local role tutr_app`);
    // Werte immer als gebundene Parameter – niemals in den SQL-Text interpolieren.
    await tx.execute(sql`select set_config('tutr.family_id', ${actor.familyId}, true)`);
    await tx.execute(sql`select set_config('tutr.actor_role', ${actor.role}, true)`);
    await tx.execute(
      sql`select set_config('tutr.student_id', ${actor.role === "student" ? actor.studentId : ""}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Nur die bestätigte Supabase-Auth-ID setzen, ohne Actor.
 *
 * Ausschließlich für den einen Schritt nach dem Login, in dem die Familie
 * noch unbekannt ist: das Nachschlagen der eigenen `parent_user`-Zeile. Die
 * zugehörige Policy erlaubt genau das und nichts sonst – kein Schreiben, kein
 * Lesen fremder Zeilen. Danach übernimmt `withActor()`.
 */
export async function runWithAuthUser<T>(
  database: Database,
  authUserId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`set local role tutr_app`);
    await tx.execute(sql`select set_config('tutr.auth_user_id', ${authUserId}, true)`);
    return fn(tx);
  });
}

export async function withAuthUser<T>(
  authUserId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return runWithAuthUser(getDb(), authUserId, fn);
}

/** Der Normalfall: Actor-Kontext auf der Laufzeitverbindung. */
export async function withActor<T>(actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return runWithActor(getDb(), actor, fn);
}
