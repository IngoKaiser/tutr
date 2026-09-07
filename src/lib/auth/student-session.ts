import { createHash, randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { withActor, withSessionTokenHash, type Actor } from "@/db/actor";

/**
 * Die Gerätesitzung des Kindes (F-06, ADR 0005).
 *
 * Der Passkey ist die eigentliche Anmeldung, die Session nur ein
 * Zwischenspeicher: Läuft sie ab, kostet das Wiederkommen einen Fingertipp.
 * Genau deshalb ist das Fenster mit 30 Tagen eher kurz gewählt – ein längeres
 * kauft kaum Bequemlichkeit, hielte aber eine Sitzung auf einem verlorenen
 * Gerät unnötig lange offen.
 *
 * Gespeichert wird nur der SHA-256 des Tokens. Wer die Tabelle liest, kann
 * sich damit nicht anmelden.
 */

export const SESSION_COOKIE = "tutr_student";
export const SESSION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Erst nach einem Tag erneuern – sonst schriebe jede Seitenansicht in die DB. */
const RENEW_WITHIN_MS = DAY_MS;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/**
 * Legt eine Sitzung an. Der Actor zeigt bereits auf das Kind – aufgerufen wird
 * das erst, nachdem der Passkey geprüft ist.
 */
export async function createSession(actor: Actor, device: string | null): Promise<string> {
  if (actor.role !== "student") throw new Error("createSession ist nur für Kind-Actor gedacht.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);

  await withActor(actor, (tx) =>
    tx.execute(
      sql`insert into student_session (student_id, token_hash, device_label, expires_at)
          values (${actor.studentId}, ${hashToken(token)}, ${device}, ${expiresAt.toISOString()})`,
    ),
  );

  return token;
}

type SessionRow = {
  student_id: string;
  expires_at: string;
  revoked_at: string | null;
};

/**
 * Prüft das Cookie und liefert den Actor – oder `null`.
 *
 * Rollierend: Ist der letzte Anstoß mehr als einen Tag her, wird das Fenster
 * neu aufgespannt. Häufiger wäre ein Datenbankschreibzugriff pro Seitenaufruf,
 * ohne dass jemand etwas davon hätte.
 */
export async function actorFromSession(token: string | undefined): Promise<Actor | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const rows = await withSessionTokenHash(tokenHash, (tx) =>
    tx.execute<SessionRow>(sql`select student_id, expires_at, revoked_at from student_session`),
  );

  const row = rows[0];
  if (!row || row.revoked_at) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const actor: Actor = { role: "student", studentId: row.student_id };

  if (expiresAt - Date.now() < SESSION_DAYS * DAY_MS - RENEW_WITHIN_MS) {
    await renew(actor, tokenHash);
  }

  return actor;
}

async function renew(actor: Actor, tokenHash: string): Promise<void> {
  const newExpiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await withActor(actor, (tx) =>
    tx.execute(
      sql`update student_session
          set expires_at = ${newExpiresAt.toISOString()}, last_seen_at = now()
          where token_hash = ${tokenHash}`,
    ),
  );
}

/** Abmelden setzt `revoked_at`, damit die Geräteliste den Vorgang zeigt. */
export async function revokeSession(token: string | undefined): Promise<void> {
  const actor = await actorFromSession(token);
  if (!actor || !token) return;

  await withActor(actor, (tx) =>
    tx.execute(
      sql`update student_session set revoked_at = now() where token_hash = ${hashToken(token)}`,
    ),
  );
}
