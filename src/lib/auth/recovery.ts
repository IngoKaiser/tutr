import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { withActor, withRecoveryTokenHash, type Actor } from "@/db/actor";
import { databaseConfigured } from "@/lib/env";

import { hashToken } from "./student-session";

/**
 * Wiederherstellung nach Passkey-Verlust (F-06d, ADR 0006 D4).
 *
 * Nur der Weg, bei dem ein angemeldetes Elternteil in der Kindliste einen
 * Link für ein bestimmtes Kind erzeugt. Der zweite, in ADR 0006 D4
 * vorgesehene Weg – Adresse eintippen, ohne jedes Elternkonto – ist F-06f:
 * Er braucht eine verifizierte Resend-Domain, ohne die die Mail niemanden
 * außer das eigene Konto erreicht, und war deshalb hier nicht sinnvoll zu
 * bauen und zu prüfen.
 *
 * Zwei Stunden Gültigkeit statt der 30 Tage einer Session oder der fünf
 * Minuten einer WebAuthn-Challenge: Der Token gewährt volle Kontoübernahme
 * (wer ihn hat, kann einen Passkey anlegen und ist als das Kind drin), muss
 * aber realistisch Zeit haben, vom Elternteil ans Kind weitergereicht zu
 * werden – AirDrop, WhatsApp, vorgelesen. Ein zu kurzes Fenster kostet eine
 * erneute Anfrage; ein zu langes hält das Konto entsprechend länger offen.
 */

export const RECOVERY_HOURS = 2;
const RECOVERY_LIFETIME_MS = RECOVERY_HOURS * 60 * 60 * 1000;

/**
 * Erzeugt einen neuen Link für das Kind, auf das der Actor zeigt. Ein neuer
 * Token überschreibt einen vorhandenen (ADR 0006 D4) – die Policy
 * `student_update_parent` erlaubt genau das, keine neue Policy nötig.
 */
export async function issueRecoveryToken(actor: Actor): Promise<string> {
  if (actor.role !== "parent") {
    throw new Error("issueRecoveryToken ist nur für Eltern-Actor gedacht.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RECOVERY_LIFETIME_MS);

  await withActor(actor, (tx) =>
    tx.execute(
      sql`update student
          set recovery_token_hash = ${hashToken(token)}, recovery_expires_at = ${expiresAt.toISOString()}
          where id = ${actor.studentId}`,
    ),
  );

  return token;
}

type RecoveryRow = { id: string; first_name: string };

/**
 * Liest, zu welchem Kind ein Token gehört – ohne ihn zu verbrauchen. Für die
 * Zwischenseite, die „Hallo Mia" zeigt, bevor die WebAuthn-Zeremonie beginnt.
 */
export async function recoveryCandidate(
  token: string,
): Promise<{ studentId: string; firstName: string } | null> {
  // Ohne Prüfung hinge ein postgres(undefined, …)-Verbindungsversuch, statt
  // sauber "ungültig" zu zeigen – derselbe Fund wie bei /einstellungen (F-06b).
  if (!databaseConfigured()) return null;

  const rows = await withRecoveryTokenHash(hashToken(token), (tx) =>
    tx.execute<RecoveryRow>(sql`select id, first_name from student`),
  );
  const row = rows[0];
  return row ? { studentId: row.id, firstName: row.first_name } : null;
}

/**
 * Verbraucht den Token. Läuft über `app.redeem_recovery_token()`
 * (security definer) statt über einen UPDATE-Pfad mit Actor-Kontext – den
 * gibt es hier noch nicht, das Kind ist ja gerade erst dabei, sich über
 * diesen Token einen zu verschaffen. Prüfen und Löschen passieren in der
 * Datenbank atomar in einem Schritt (siehe Kommentar dort); zwei
 * gleichzeitige Versuche mit demselben Token können also nicht beide
 * gewinnen.
 *
 * Die Schleuse `withRecoveryTokenHash` trägt hier nichts zur Berechtigung
 * bei – `redeem_recovery_token()` bekommt den Hash als Parameter, nicht aus
 * der Session-Variable. Sie steht trotzdem drum herum, aus demselben Grund
 * wie bei `students_by_parent_email()` in F-06b: `set local role tutr_app`
 * bleibt so auch hier die einzige Art, wie dieser Code die Datenbank anfasst.
 */
export async function redeemRecoveryToken(token: string): Promise<string | null> {
  if (!databaseConfigured()) return null;

  const tokenHash = hashToken(token);
  const rows = await withRecoveryTokenHash(tokenHash, (tx) =>
    tx.execute<{ id: string | null }>(sql`select app.redeem_recovery_token(${tokenHash}) as id`),
  );
  return rows[0]?.id ?? null;
}
