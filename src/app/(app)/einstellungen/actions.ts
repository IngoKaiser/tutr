"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withActor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { databaseConfigured } from "@/lib/env";

/**
 * Geräteliste des gerade gewählten Kindes (F-06b).
 *
 * Der Actor kommt **ausschließlich** aus `loginStatus()`, nie als Parameter
 * von außen: Server Actions sind erreichbare Endpunkte, ihre Argumente
 * kommen vom Client. Ein `Actor` als Parameter hieße, einem manipulierten
 * Aufruf zu glauben, welches Kind gemeint ist – die einzig verlässliche
 * Quelle ist die serverseitig geprüfte Session plus das gewählte Kind aus
 * dem Cookie (`selectedStudentId()`), beides steckt in `loginStatus()`.
 *
 * Die Policies `student_credential_read_parent` und `student_session_read_
 * parent` filtern zusätzlich auf `student_id = app.student_id()` – selbst
 * eine erratene fremde ID eines anderen eigenen Kindes träfe keine Zeile.
 *
 * `databaseConfigured()` schützt den Dev-Actor-Bypass: Die E2E-Umgebung
 * läuft ohne `DATABASE_URL`, und diese Seite ist die erste unter dem Bypass,
 * die überhaupt eine Datenbankverbindung braucht. Ohne die Prüfung hinge der
 * Verbindungsversuch dort, statt sauber den leeren Zustand zu zeigen.
 */

type CredentialRow = {
  id: string;
  device_label: string | null;
  last_used_at: string | null;
  created_at: string;
};
type SessionRow = {
  id: string;
  device_label: string | null;
  last_seen_at: string;
  revoked_at: string | null;
};

export type DeviceList = { credentials: CredentialRow[]; sessions: SessionRow[] };

async function requireParentActor() {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  if (!actor || actor.role !== "parent") return null;
  return actor;
}

export async function loadDevices(): Promise<DeviceList | null> {
  const actor = await requireParentActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const credentials = await tx.execute<CredentialRow>(
      sql`select id, device_label, last_used_at, created_at
          from student_credential order by created_at`,
    );
    const sessions = await tx.execute<SessionRow>(
      sql`select id, device_label, last_seen_at, revoked_at
          from student_session where revoked_at is null order by last_seen_at desc`,
    );
    return { credentials, sessions };
  });
}

/** Entfernt einen Passkey – z. B. ein verlorenes Gerät. */
export async function removeCredential(credentialId: string): Promise<void> {
  const actor = await requireParentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`delete from student_credential where id = ${credentialId}`),
  );
  revalidatePath("/einstellungen");
}

/** Meldet ein Gerät ab, statt die Sitzung zu löschen (Geräteliste soll es zeigen). */
export async function revokeStudentSession(sessionId: string): Promise<void> {
  const actor = await requireParentActor();
  if (!actor) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`update student_session set revoked_at = now() where id = ${sessionId}`),
  );
  revalidatePath("/einstellungen");
}
