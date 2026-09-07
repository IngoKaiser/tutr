"use server";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { withActor, withCredentialId, type Actor } from "@/db/actor";
import { challengeCookieName, challengeMaxAge, pruefeChallenge } from "@/lib/auth/challenge";
import { anmeldeOptionen, pruefeAnmeldung } from "@/lib/auth/passkey";
import { SESSION_COOKIE, sessionAnlegen, sessionCookieOptionen } from "@/lib/auth/student-session";

/**
 * Anmeldung des Kindes mit einem Passkey (F-06, ADR 0005).
 *
 * Ohne Kennung: Der Browser fragt selbst, welcher Passkey gemeint ist, und
 * liefert dessen ID zurück. Damit schlagen wir das Kind nach – über den engen
 * Weg `withCredentialId`, der genau diese eine Zeile freigibt und sonst
 * nichts (`src/db/policies/0050-student-auth.sql`).
 */

export type PasskeyStart = { zustand: "bereit"; optionen: unknown } | { zustand: "fehler" };
export type PasskeyErgebnis = { zustand: "fertig" } | { zustand: "fehler"; meldung: string };

export async function anmeldungStarten(): Promise<PasskeyStart> {
  const { optionen, cookie } = await anmeldeOptionen();

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

type PasskeyZeile = {
  student_id: string;
  public_key: string;
  counter: string;
  transports: string[] | null;
};

export async function anmeldungAbschliessen(
  antwort: AuthenticationResponseJSON,
): Promise<PasskeyErgebnis> {
  const kekse = await cookies();
  const gemerkt = pruefeChallenge("anmelden", kekse.get(challengeCookieName)?.value);
  if (!gemerkt) {
    return { zustand: "fehler", meldung: "Das hat zu lange gedauert. Versuch es noch einmal." };
  }

  const zeilen = await withCredentialId(antwort.id, (tx) =>
    tx.execute<PasskeyZeile>(
      sql`select student_id, public_key, counter, transports from student_credential`,
    ),
  );
  const zeile = zeilen[0];
  if (!zeile) {
    return {
      zustand: "fehler",
      meldung: "Dieser Passkey gehört zu keinem Profil. Leg dir eines an.",
    };
  }

  const geprueft = await pruefeAnmeldung(antwort, gemerkt.challenge, {
    credentialId: antwort.id,
    publicKey: zeile.public_key,
    // `bigint` kommt als Zeichenkette aus dem Treiber zurück.
    counter: Number(zeile.counter),
    transports: zeile.transports,
  });
  if (!geprueft) {
    return { zustand: "fehler", meldung: "Der Passkey ließ sich nicht bestätigen." };
  }
  kekse.delete(challengeCookieName);

  const actor: Actor = { role: "student", studentId: zeile.student_id };

  await withActor(actor, (tx) =>
    tx.execute(
      sql`update student_credential
          set counter = ${geprueft.neuerZaehler}, last_used_at = now()
          where credential_id = ${antwort.id}`,
    ),
  );

  const kopf = await headers();
  const token = await sessionAnlegen(actor, kopf.get("user-agent"));
  kekse.set(SESSION_COOKIE, token, sessionCookieOptionen());

  return { zustand: "fertig" };
}
