"use server";

import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies, headers } from "next/headers";

import { withActor, type Actor } from "@/db/actor";
import { schoolYear, student, studentCredential } from "@/db/schema";
import { challengeCookieName, challengeMaxAge, verifyChallenge } from "@/lib/auth/challenge";
import { registrationOptions, verifyRegistration } from "@/lib/auth/passkey";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/student-session";
import { consentEmail } from "@/lib/mail/consent";
import { sendMail } from "@/lib/mail/resend";
import { currentSchoolYear } from "@/lib/school-year/current";

/**
 * Selbstanlage des Kind-Profils (F-06, ADR 0005).
 *
 * Zwei Schritte, weil WebAuthn zwei braucht: erst Optionen holen, dann die
 * Antwort des Geräts prüfen. Alles, was dazwischen zu merken ist – Profil und
 * die frisch erzeugten IDs –, liegt im signierten Cookie, nicht beim Client.
 *
 * Die Reihenfolge im zweiten Schritt ist Absicht:
 * Passkey prüfen → Mail schicken → schreiben. Erst prüfen, damit niemand über
 * ein abgeschicktes Formular fremde Postfächer bespielt. Und der Mail-Versand
 * vor dem Schreiben, weil `consent_requested_at` dann die Wahrheit sagt,
 * ohne dass eine zweite Schreibpolicy nötig wäre.
 */

export type Profile = {
  firstName: string;
  gradeLevel: number;
  parentEmail: string;
};

type Remembered = Profile & { studentId: string };

export type StartResult =
  { status: "ready"; options: unknown } | { status: "error"; message: string };

export type CompletionResult = { status: "done" } | { status: "error"; message: string };

function validateProfile(formData: FormData): Profile | string {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const gradeLevel = Number(formData.get("gradeLevel"));
  const parentEmail = String(formData.get("parentEmail") ?? "").trim();

  if (firstName.length < 2) return "Bitte trag deinen Vornamen ein.";
  if (firstName.length > 40) return "Der Vorname ist zu lang.";
  if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 13) {
    return "Bitte wähl deinen Jahrgang.";
  }
  if (!parentEmail.includes("@") || parentEmail.length < 5) {
    return "Bitte trag die E-Mail-Adresse deiner Eltern ein.";
  }

  return { firstName, gradeLevel, parentEmail };
}

/** Schritt 1: Profil prüfen, IDs erzeugen, Passkey-Optionen ausliefern. */
export async function startRegistration(
  _previous: StartResult | null,
  formData: FormData,
): Promise<StartResult> {
  const profile = validateProfile(formData);
  if (typeof profile === "string") return { status: "error", message: profile };

  const remembered: Remembered = { ...profile, studentId: crypto.randomUUID() };

  const { options, cookie } = await registrationOptions(
    remembered.studentId,
    remembered.firstName,
    remembered,
  );

  const cookieStore = await cookies();
  cookieStore.set(challengeCookieName, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: challengeMaxAge,
  });

  return { status: "ready", options };
}

/** Schritt 2: Antwort des Geräts prüfen, Mail schicken, Kind anlegen. */
export async function completeRegistration(
  response: RegistrationResponseJSON,
): Promise<CompletionResult> {
  const cookieStore = await cookies();
  const remembered = verifyChallenge<Remembered>(
    "register",
    cookieStore.get(challengeCookieName)?.value,
  );

  if (!remembered) {
    return {
      status: "error",
      message: "Das hat zu lange gedauert. Fang bitte noch einmal von vorn an.",
    };
  }

  const passkey = await verifyRegistration(response, remembered.challenge);
  if (!passkey) {
    return { status: "error", message: "Der Passkey ließ sich nicht bestätigen." };
  }
  cookieStore.delete(challengeCookieName);

  const headerList = await headers();
  const origin = headerList.get("origin") ?? "http://localhost:3000";
  const mailResult = await sendMail({
    to: remembered.parentEmail,
    ...consentEmail({ firstName: remembered.firstName, origin }),
  });
  // Ein Ausfall beim Versand hält niemanden auf – das ist der Punkt von
  // ADR 0005. Festgehalten wird der Versand hier bewusst nicht: Die
  // Einwilligung entsteht erst mit der Verknüpfung (`parent_student.consent_at`,
  // ADR 0006 D1), und die legt das Elternteil an, nicht das Kind.
  if (mailResult.status === "error") {
    console.warn("Einwilligungsmail nicht zugestellt:", mailResult.message);
  }

  const actor: Actor = { role: "student", studentId: remembered.studentId };

  // Über den Query-Builder statt über rohes SQL: `transports` ist ein
  // text[]-Feld, und eine JS-Liste in einem sql``-Literal wird von Drizzle zur
  // Wertliste `($1)` ausgerollt statt als Array gebunden.
  //
  // Seit ADR 0006 entstehen hier zwei Zeilen statt drei: Eine Familie gibt es
  // nicht mehr, das Kind selbst ist der Mandant.
  await withActor(actor, async (tx) => {
    await tx.insert(student).values({
      id: remembered.studentId,
      firstName: remembered.firstName,
      gradeLevel: remembered.gradeLevel,
      // Die Adresse ist der Wiederherstellungsanker und die Bedingung, unter
      // der sich später ein Elternkonto verknüpfen darf (`app.parent_may_link`).
      parentEmail: remembered.parentEmail,
      // Die Klasse wird hier bewusst nicht gefragt. Ihr einziger Verbraucher
      // ist der Gruppenfilter beim Klausurplan-Import (K-03), und die
      // maßgebliche Kopie steht auf `school_year` – hier wäre sie nur ein
      // Startwert. Der erste Bildschirm bleibt dafür um ein Feld kürzer.
    });
    await tx.insert(studentCredential).values({
      studentId: remembered.studentId,
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
      transports: passkey.transports,
    });
    // Das aktive Schuljahr entsteht mit dem Profil (F-16a, ADR 0009): Ohne
    // Schuljahr kann später kein Fach zugeordnet werden
    // (`school_year_subject`), und `topic.school_year_id` ist `not null`.
    // Jahrgang und Klasse kommen aus dem Profil – die Klasse bleibt hier
    // `null`, weil sie beim Anlegen nicht gefragt wird (siehe oben); wer sie
    // braucht, trägt sie am Schuljahr selbst nach.
    const { label, startDate, endDate } = currentSchoolYear(new Date());
    await tx.insert(schoolYear).values({
      studentId: remembered.studentId,
      label,
      gradeLevel: remembered.gradeLevel,
      startDate,
      endDate,
      status: "aktiv",
    });
  });

  const token = await createSession(actor, headerList.get("user-agent"));
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  return { status: "done" };
}
