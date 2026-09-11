"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { headers } from "next/headers";

import { logout } from "@/app/anmelden/actions";
import { withActor } from "@/db/actor";
import { ladeGesamtauslastung, type Auslastung } from "@/lib/ai/rate-limit";
import { loginStatus } from "@/lib/auth/actor";
import { deleteChildAsParent, deleteParentAccount, deleteSelfAsStudent } from "@/lib/auth/deletion";
import { databaseConfigured } from "@/lib/env";
import { deletionEmail } from "@/lib/mail/deletion";
import { issueRecoveryToken } from "@/lib/auth/recovery";
import { sendMail } from "@/lib/mail/resend";

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

async function requireStudentActor() {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  if (!actor || actor.role !== "student") return null;
  return actor;
}

/** Der eigene Vorname eines Kind-Actors – für die Löschbestätigung auf der eigenen Einstellungsseite (F-06e). */
export async function loadOwnFirstName(): Promise<string | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  const rows = await withActor(actor, (tx) =>
    tx.execute<{ first_name: string }>(
      sql`select first_name from student where id = ${actor.studentId}`,
    ),
  );
  return rows[0]?.first_name ?? null;
}

/**
 * Das Label des aktiven Schuljahres, nur zum Anzeigen (F-16a, ADR 0009).
 *
 * Für beide Rollen: Ein Elternteil soll ohne Umweg sehen, in welchem
 * Schuljahr das gewählte Kind gerade steht. Kein Formular dazu – das
 * Umschalten/Anlegen weiterer Jahre kommt erst mit F-16b, solange es genau
 * eins gibt, hätte ein Umschalter nichts zu tun.
 */
export async function loadActiveSchoolYearLabel(): Promise<string | null> {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  if (!actor) return null;

  const rows = await withActor(actor, (tx) =>
    tx.execute<{ label: string }>(
      sql`select label from school_year where student_id = ${actor.studentId} and status = 'aktiv'`,
    ),
  );
  return rows[0]?.label ?? null;
}

/**
 * Die volle Fortschrittsanzeige (S-03c): alle drei Fenster, nur fürs Kind
 * selbst – dieselbe Richtung wie beim Tutor (kein Elternzugriff auf
 * `ai_usage`, ADR 0012 D3 sinngemäß: Kosten hängen direkt an der eigenen
 * Nutzung). Der dezente Hinweis in der Tutor-Übersicht zeigt nur das
 * straffste Fenster, hier stehen alle drei nebeneinander.
 */
export async function loadAuslastung(): Promise<Auslastung | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;
  return withActor(actor, (tx) => ladeGesamtauslastung(tx));
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

/**
 * Erzeugt einen Wiederherstellungslink für das gerade gewählte Kind (F-06d).
 *
 * Gibt die volle URL genau einmal zurück – hier, nicht über einen erneuten
 * Seitenaufruf: Der rohe Token ist ein Geheimnis, gespeichert wird nur sein
 * Hash (`issueRecoveryToken()`), ein Neuladen der Seite könnte ihn also gar
 * nicht zeigen.
 */
export async function createRecoveryLink(): Promise<string | null> {
  const actor = await requireParentActor();
  if (!actor) return null;

  const token = await issueRecoveryToken(actor);
  const headerList = await headers();
  const origin = headerList.get("origin") ?? "http://localhost:3000";
  return `${origin}/wiederherstellen?token=${token}`;
}

/**
 * Ein Elternteil löscht das Kind, auf das sein Actor gerade zeigt (F-06e).
 *
 * Kein `logout()`, kein Redirect: Das Elternteil bleibt angemeldet, hat
 * vielleicht weitere Kinder, und `loginStatus()` wählt beim nächsten
 * Seitenaufruf automatisch neu (`selectedStudentId()` fällt zurück, wenn das
 * gewählte Kind nicht mehr in `login.students` steckt). War es das letzte
 * Kind, greift `parentWithoutStudent` – derselbe leere Zustand wie sonst auch.
 */
export async function deleteChild(): Promise<void> {
  const actor = await requireParentActor();
  if (!actor) return;

  await deleteChildAsParent(actor);
  revalidatePath("/einstellungen");
}

/**
 * Ein Kind löscht sich selbst (F-06e, ADR 0006 D6).
 *
 * Die Benachrichtigungsmails laufen **nach** der erfolgreich committeten
 * Löschtransaktion, nicht davor: `sendMail()` wirft nie, aber ein
 * Mail-Ausfall darf das Löschen so oder so nicht verhindern oder verzögern.
 */
export async function deleteMyAccount(): Promise<void> {
  const actor = await requireStudentActor();
  if (!actor) return;

  const result = await deleteSelfAsStudent(actor);
  for (const parent of result.notify) {
    await sendMail({ to: parent.email, ...deletionEmail({ ...result, ...parent }) });
  }

  await logout();
  redirect("/konto-geloescht");
}

/**
 * Ein Elternteil löscht das eigene Konto (F-06e, ADR 0006 D5).
 *
 * Keine Bestätigung durch Eintippen eines Namens, anders als bei den beiden
 * Wegen oben: Die Kinder bleiben unberührt, der Vorgang ist umkehrbar – bei
 * erneuter Anmeldung mit derselben Adresse entsteht das Konto über den
 * Beitritt (`join()`) automatisch neu, sofern ein Kind diese Adresse weiter
 * einträgt.
 */
export async function deleteMyParentAccount(): Promise<void> {
  const actor = await requireParentActor();
  if (!actor) return;

  await deleteParentAccount(actor);
  await logout();
  redirect("/konto-geloescht");
}
