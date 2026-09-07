"use server";

import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies, headers } from "next/headers";

import { withActor, type Actor } from "@/db/actor";
import { student, studentCredential } from "@/db/schema";
import { challengeCookieName, challengeMaxAge, pruefeChallenge } from "@/lib/auth/challenge";
import { registrierungsOptionen, pruefeRegistrierung } from "@/lib/auth/passkey";
import { SESSION_COOKIE, sessionAnlegen, sessionCookieOptionen } from "@/lib/auth/student-session";
import { einwilligungsmail } from "@/lib/mail/einwilligung";
import { sendeMail } from "@/lib/mail/resend";

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

export type Profil = {
  vorname: string;
  jahrgang: number;
  elternMail: string;
};

type Gemerkt = Profil & { studentId: string };

export type StartErgebnis =
  { zustand: "bereit"; optionen: unknown } | { zustand: "fehler"; meldung: string };

export type AbschlussErgebnis = { zustand: "fertig" } | { zustand: "fehler"; meldung: string };

function pruefeProfil(formData: FormData): Profil | string {
  const vorname = String(formData.get("vorname") ?? "").trim();
  const jahrgang = Number(formData.get("jahrgang"));
  const elternMail = String(formData.get("elternMail") ?? "").trim();

  if (vorname.length < 2) return "Bitte trag deinen Vornamen ein.";
  if (vorname.length > 40) return "Der Vorname ist zu lang.";
  if (!Number.isInteger(jahrgang) || jahrgang < 1 || jahrgang > 13) {
    return "Bitte wähl deinen Jahrgang.";
  }
  if (!elternMail.includes("@") || elternMail.length < 5) {
    return "Bitte trag die E-Mail-Adresse deiner Eltern ein.";
  }

  return { vorname, jahrgang, elternMail };
}

/** Schritt 1: Profil prüfen, IDs erzeugen, Passkey-Optionen ausliefern. */
export async function registrierungStarten(
  _vorher: StartErgebnis | null,
  formData: FormData,
): Promise<StartErgebnis> {
  const profil = pruefeProfil(formData);
  if (typeof profil === "string") return { zustand: "fehler", meldung: profil };

  const gemerkt: Gemerkt = { ...profil, studentId: crypto.randomUUID() };

  const { optionen, cookie } = await registrierungsOptionen(
    gemerkt.studentId,
    gemerkt.vorname,
    gemerkt,
  );

  const kekse = await cookies();
  kekse.set(challengeCookieName, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: challengeMaxAge,
  });

  return { zustand: "bereit", optionen };
}

/** Schritt 2: Antwort des Geräts prüfen, Mail schicken, Familie anlegen. */
export async function registrierungAbschliessen(
  antwort: RegistrationResponseJSON,
): Promise<AbschlussErgebnis> {
  const kekse = await cookies();
  const gemerkt = pruefeChallenge<Gemerkt>("registrieren", kekse.get(challengeCookieName)?.value);

  if (!gemerkt) {
    return {
      zustand: "fehler",
      meldung: "Das hat zu lange gedauert. Fang bitte noch einmal von vorn an.",
    };
  }

  const passkey = await pruefeRegistrierung(antwort, gemerkt.challenge);
  if (!passkey) {
    return { zustand: "fehler", meldung: "Der Passkey ließ sich nicht bestätigen." };
  }
  kekse.delete(challengeCookieName);

  const kopf = await headers();
  const herkunft = kopf.get("origin") ?? "http://localhost:3000";
  const mail = await sendeMail({
    an: gemerkt.elternMail,
    ...einwilligungsmail({ vorname: gemerkt.vorname, herkunft }),
  });
  // Ein Ausfall beim Versand hält niemanden auf – das ist der Punkt von
  // ADR 0005. Festgehalten wird der Versand hier bewusst nicht: Die
  // Einwilligung entsteht erst mit der Verknüpfung (`parent_student.consent_at`,
  // ADR 0006 D1), und die legt das Elternteil an, nicht das Kind.
  if (mail.zustand === "fehler") {
    console.warn("Einwilligungsmail nicht zugestellt:", mail.meldung);
  }

  const actor: Actor = { role: "student", studentId: gemerkt.studentId };

  // Über den Query-Builder statt über rohes SQL: `transports` ist ein
  // text[]-Feld, und eine JS-Liste in einem sql``-Literal wird von Drizzle zur
  // Wertliste `($1)` ausgerollt statt als Array gebunden.
  //
  // Seit ADR 0006 entstehen hier zwei Zeilen statt drei: Eine Familie gibt es
  // nicht mehr, das Kind selbst ist der Mandant.
  await withActor(actor, async (tx) => {
    await tx.insert(student).values({
      id: gemerkt.studentId,
      firstName: gemerkt.vorname,
      gradeLevel: gemerkt.jahrgang,
      // Die Adresse ist der Wiederherstellungsanker und die Bedingung, unter
      // der sich später ein Elternkonto verknüpfen darf (`app.parent_may_link`).
      parentEmail: gemerkt.elternMail,
      // Die Klasse wird hier bewusst nicht gefragt. Ihr einziger Verbraucher
      // ist der Gruppenfilter beim Klausurplan-Import (K-03), und die
      // maßgebliche Kopie steht auf `school_year` – hier wäre sie nur ein
      // Startwert. Der erste Bildschirm bleibt dafür um ein Feld kürzer.
    });
    await tx.insert(studentCredential).values({
      studentId: gemerkt.studentId,
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
      transports: passkey.transports,
    });
  });

  const token = await sessionAnlegen(actor, kopf.get("user-agent"));
  kekse.set(SESSION_COOKIE, token, sessionCookieOptionen());

  return { zustand: "fertig" };
}
