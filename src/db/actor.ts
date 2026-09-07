import { sql } from "drizzle-orm";

import { getDb } from "./index";

/**
 * Wer stellt die Anfrage (ADR 0004 D1, umgestellt durch ADR 0006 D2).
 *
 * **Beide Rollen tragen eine `studentId`** – auch das Elternteil, denn eine
 * Elternansicht zeigt immer ein Kind zur Zeit. Dadurch vergleicht jede Policy
 * dieselbe Spalte, und die Rolle entscheidet nur noch über lesen oder
 * schreiben. Vorher unterschieden sich die Rollen darin, *welche* Spalte sie
 * prüfen; das war die Quelle der meisten Sonderfälle.
 *
 * Die Frage „darf dieses Elternteil für dieses Kind handeln?" wird **einmal**
 * beim Bau des Actors über `parent_student` beantwortet, nicht in jeder
 * Policy erneut.
 */
export type Actor =
  { role: "student"; studentId: string } | { role: "parent"; studentId: string; parentId: string };

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
    await tx.execute(sql`select set_config('tutr.student_id', ${actor.studentId}, true)`);
    await tx.execute(sql`select set_config('tutr.actor_role', ${actor.role}, true)`);
    await tx.execute(
      sql`select set_config('tutr.parent_id', ${actor.role === "parent" ? actor.parentId : ""}, true)`,
    );
    return fn(tx);
  });
}

/** Der Normalfall: Actor-Kontext auf der Laufzeitverbindung. */
export async function withActor<T>(actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return runWithActor(getDb(), actor, fn);
}

/**
 * Die Anmeldeschleusen (ADR 0006 D3).
 *
 * Jeder Weg, der ohne Actor-Kontext auskommen muss, bekommt eine eigene
 * Session-Variable, zu der es genau eine `select`-Policy auf genau eine Zeile
 * gibt (`src/db/policies/0010-auth.sql`):
 *
 * | Variable                   | Tabelle              | Wofür              |
 * | -------------------------- | -------------------- | ------------------ |
 * | `tutr.auth_user_id`        | `parent_account`     | Eltern-Login       |
 * | `tutr.credential_id`       | `student_credential` | Passkey vorzeigen  |
 * | `tutr.session_token_hash`  | `student_session`    | Session prüfen     |
 *
 * Ein Actor-Kontext entsteht dabei nicht: `app.student_id()` und
 * `app.actor_role()` bleiben leer, alle übrigen Policies greifen also ins
 * Leere. Erst nach dem Nachschlagen übernimmt `withActor()`.
 *
 * Sie bleiben ausdrücklich einzeln statt verallgemeinert – drei kurze
 * Policies liest man, eine clevere nicht.
 */
export type LoginKey = "tutr.auth_user_id" | "tutr.credential_id" | "tutr.session_token_hash";

export async function runWithLoginKey<T>(
  database: Database,
  variable: LoginKey,
  wert: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`set local role tutr_app`);
    // Der Variablenname ist ein Literal aus dem Union-Typ oben, nie Eingabe.
    await tx.execute(sql`select set_config(${variable}, ${wert}, true)`);
    return fn(tx);
  });
}

/**
 * Nach dem Magic Link: das Elternkonto und – über dieselbe Schleuse – die
 * verknüpften Kinder nachschlagen, bevor eines gewählt ist.
 */
export async function withAuthUser<T>(
  authUserId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return runWithLoginKey(getDb(), "tutr.auth_user_id", authUserId, fn);
}

/** Nachschlagen eines Passkeys anhand der vom Browser gelieferten ID. */
export async function withCredentialId<T>(
  credentialId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return runWithLoginKey(getDb(), "tutr.credential_id", credentialId, fn);
}

/** Nachschlagen einer Session anhand des SHA-256 des Cookie-Tokens. */
export async function withSessionTokenHash<T>(
  tokenHash: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return runWithLoginKey(getDb(), "tutr.session_token_hash", tokenHash, fn);
}
