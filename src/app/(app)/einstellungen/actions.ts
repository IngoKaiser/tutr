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
import { nextSchoolYearWindow } from "@/lib/school-year/rollover";

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

async function requireActor() {
  if (!databaseConfigured()) return null;
  const { actor } = await loginStatus();
  return actor;
}

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

export type OwnProfile = { firstName: string; gradeLevel: number; className: string | null };

/** Das eigene Profil zum Bearbeiten (F-06c) – dieselben drei Felder, die `updateOwnProfile()` schreiben darf. */
export async function loadOwnProfile(): Promise<OwnProfile | null> {
  const actor = await requireStudentActor();
  if (!actor) return null;

  const rows = await withActor(actor, (tx) =>
    tx.execute<{ first_name: string; grade_level: number; class_name: string | null }>(
      sql`select first_name, grade_level, class_name from student where id = ${actor.studentId}`,
    ),
  );
  const row = rows[0];
  if (!row) return null;
  return { firstName: row.first_name, gradeLevel: row.grade_level, className: row.class_name };
}

export type ProfileUpdateResult = { status: "ok" } | { status: "error"; message: string };

/**
 * Grenzen wie bei `validateProfile()` in `registrieren/actions.ts` (Vorname,
 * Jahrgang) – hier eigenständig, weil die Klasse dort gar nicht abgefragt
 * wird (F-06, Nachtrag) und die beiden Formulare sonst nichts teilen.
 */
function validateProfileInput(input: {
  firstName: string;
  gradeLevel: number;
  className: string;
}): OwnProfile | string {
  const firstName = input.firstName.trim();
  const className = input.className.trim();

  if (firstName.length < 2) return "Bitte trag deinen Vornamen ein.";
  if (firstName.length > 40) return "Der Vorname ist zu lang.";
  if (!Number.isInteger(input.gradeLevel) || input.gradeLevel < 1 || input.gradeLevel > 13) {
    return "Bitte wähl deinen Jahrgang.";
  }
  if (className.length > 20) return "Die Klasse ist zu lang.";

  return {
    firstName,
    gradeLevel: input.gradeLevel,
    className: className.length ? className : null,
  };
}

/**
 * Kind ändert sein eigenes Profil (F-06c). Nur diese drei Felder – die
 * Policy `student_update_self` erlaubt zwar die ganze Zeile (Postgres kennt
 * keine spaltenweise Sichtbarkeit, siehe die Policy-Datei), aber genau diese
 * Enge stellt diese Funktion her: `parentEmail`, die Wiederherstellungs- und
 * Zeitstempelspalten erscheinen hier nie im `SET`.
 */
export async function updateOwnProfile(input: {
  firstName: string;
  gradeLevel: number;
  className: string;
}): Promise<ProfileUpdateResult> {
  const actor = await requireStudentActor();
  if (!actor) return { status: "error", message: "Nicht angemeldet." };

  const validated = validateProfileInput(input);
  if (typeof validated === "string") return { status: "error", message: validated };

  await withActor(actor, (tx) =>
    tx.execute(
      sql`update student
          set first_name = ${validated.firstName},
              grade_level = ${validated.gradeLevel},
              class_name = ${validated.className}
          where id = ${actor.studentId}`,
    ),
  );
  revalidatePath("/einstellungen");
  return { status: "ok" };
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

export type ActiveSchoolYear = {
  label: string;
  gradeLevel: number;
  className: string | null;
  startDate: string;
};

/** Wie `loadActiveSchoolYearLabel()`, nur mit den Feldern, die der Vorschlag fürs nächste Jahr braucht (F-16b). */
export async function loadActiveSchoolYear(): Promise<ActiveSchoolYear | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const rows = await withActor(actor, (tx) =>
    tx.execute<{
      label: string;
      grade_level: number;
      class_name: string | null;
      start_date: string;
    }>(
      sql`select label, grade_level, class_name, start_date
          from school_year where student_id = ${actor.studentId} and status = 'aktiv'`,
    ),
  );
  const row = rows[0];
  if (!row) return null;
  return {
    label: row.label,
    gradeLevel: row.grade_level,
    className: row.class_name,
    startDate: row.start_date,
  };
}

export type SchoolYearRow = {
  id: string;
  label: string;
  gradeLevel: number;
  className: string | null;
  status: "geplant" | "aktiv" | "archiviert";
};

/**
 * Alle Schuljahre des Kindes, neueste zuerst (F-16b). „Meine Schuljahre" ist
 * laut Konzept §9 read-only – diese Funktion liest nur, geschrieben wird
 * ausschließlich über `startNewSchoolYear()`.
 */
export async function loadSchoolYearHistory(): Promise<SchoolYearRow[] | null> {
  const actor = await requireActor();
  if (!actor) return null;

  const rows = await withActor(actor, (tx) =>
    tx.execute<{
      id: string;
      label: string;
      grade_level: number;
      class_name: string | null;
      status: "geplant" | "aktiv" | "archiviert";
    }>(
      sql`select id, label, grade_level, class_name, status
          from school_year
          where student_id = ${actor.studentId}
          order by start_date desc`,
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    gradeLevel: r.grade_level,
    className: r.class_name,
    status: r.status,
  }));
}

/** Die Fächer und Vokabelsets eines (auch vergangenen) Schuljahres – für die Historie-Ansicht. */
export async function loadSchoolYearDetail(schoolYearId: string): Promise<{
  subjects: { id: string; name: string }[];
  vocabSets: { id: string; title: string }[];
} | null> {
  const actor = await requireActor();
  if (!actor) return null;

  return withActor(actor, async (tx) => {
    const subjects = await tx.execute<{ id: string; name: string }>(
      sql`select s.id, s.name
          from subject s
          join school_year_subject sys on sys.subject_id = s.id
          where sys.school_year_id = ${schoolYearId}
          order by s.name`,
    );
    const vocabSets = await tx.execute<{ id: string; title: string }>(
      sql`select id, title from vocab_set where school_year_id = ${schoolYearId} order by title`,
    );
    return { subjects, vocabSets };
  });
}

export type StartSchoolYearResult = { status: "ok" } | { status: "error"; message: string };

/**
 * Eröffnet ein neues Schuljahr (F-16b, §9 Sommer-Assistent – nur der manuelle
 * Teil, siehe `rollover.ts`): archiviert das aktive Jahr, legt in derselben
 * Transaktion das neue aktive an. Fächer/Lehrwerke werden **nicht**
 * mitkopiert (ADR 0009 D2: „neues Jahr heißt leere Fächerliste") – das Kind
 * wählt unter „Fächer" neu, wie beim allerersten Schuljahr auch.
 */
export async function startNewSchoolYear(input: {
  gradeLevel: number;
  className: string;
}): Promise<StartSchoolYearResult> {
  const actor = await requireActor();
  if (!actor) return { status: "error", message: "Nicht angemeldet." };

  const className = input.className.trim();
  if (!Number.isInteger(input.gradeLevel) || input.gradeLevel < 1 || input.gradeLevel > 13) {
    return { status: "error", message: "Bitte einen gültigen Jahrgang wählen." };
  }
  if (className.length > 20) return { status: "error", message: "Die Klasse ist zu lang." };

  return withActor(actor, async (tx) => {
    const [current] = await tx.execute<{ id: string; start_date: string }>(
      sql`select id, start_date from school_year
          where student_id = ${actor.studentId} and status = 'aktiv'`,
    );
    if (!current) {
      return { status: "error", message: "Kein aktives Schuljahr gefunden." };
    }

    const { label, startDate, endDate } = nextSchoolYearWindow(current.start_date);

    await tx.execute(sql`update school_year set status = 'archiviert' where id = ${current.id}`);
    await tx.execute(
      sql`insert into school_year (student_id, label, grade_level, class_name, start_date, end_date, status)
          values (${actor.studentId}, ${label}, ${input.gradeLevel}, ${className || null}, ${startDate}, ${endDate}, 'aktiv')`,
    );

    revalidatePath("/einstellungen");
    return { status: "ok" };
  });
}

/**
 * Die volle Fortschrittsanzeige (S-03d): alle drei Fenster, nur fürs Kind
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
