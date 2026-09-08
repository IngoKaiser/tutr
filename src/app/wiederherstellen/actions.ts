"use server";

import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies, headers } from "next/headers";

import { withActor, type Actor } from "@/db/actor";
import { studentCredential } from "@/db/schema";
import { challengeCookieName, challengeMaxAge, verifyChallenge } from "@/lib/auth/challenge";
import { registrationOptions, verifyRegistration } from "@/lib/auth/passkey";
import { recoveryCandidate, redeemRecoveryToken } from "@/lib/auth/recovery";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/student-session";

/**
 * Wiederherstellung: ein weiterer Passkey für ein bestehendes Kind (F-06d).
 *
 * Zwei Schritte wie bei der Registrierung (F-06), aus demselben Grund –
 * WebAuthn braucht erst Optionen, dann eine Antwort des Geräts. Der
 * Unterschied ist, wofür der neue Passkey angelegt wird: Bei F-06 entsteht
 * dabei das Kind, hier existiert es längst, und der rohe Token wandert
 * unverändert im signierten Cookie mit, damit Schritt 2 ihn verbrauchen kann,
 * ohne dass der Client ihn kennen müsste.
 */

export type StartResult =
  { status: "ready"; options: unknown; firstName: string } | { status: "error"; message: string };

export type CompletionResult = { status: "done" } | { status: "error"; message: string };

type Remembered = { studentId: string; token: string };

export async function startRecovery(token: string): Promise<StartResult> {
  const candidate = await recoveryCandidate(token);
  if (!candidate) {
    return {
      status: "error",
      message: "Dieser Link ist ungültig oder abgelaufen. Lass dir einen neuen geben.",
    };
  }

  const remembered: Remembered = { studentId: candidate.studentId, token };
  const { options, cookie } = await registrationOptions(
    candidate.studentId,
    candidate.firstName,
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

  return { status: "ready", options, firstName: candidate.firstName };
}

export async function completeRecovery(
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

  // Erst jetzt, nach erfolgreicher Zeremonie, wird der Token verbraucht – ein
  // vorab öffnender Mail- oder Link-Scanner kann diesen Schritt nicht
  // auslösen, das verlangt einen echten Authenticator.
  const studentId = await redeemRecoveryToken(remembered.token);
  if (!studentId) {
    return {
      status: "error",
      message: "Der Link wurde inzwischen schon verwendet oder ist abgelaufen.",
    };
  }

  const actor: Actor = { role: "student", studentId };

  await withActor(actor, (tx) =>
    tx.insert(studentCredential).values({
      studentId,
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
      transports: passkey.transports,
    }),
  );

  const headerList = await headers();
  const sessionToken = await createSession(actor, headerList.get("user-agent"));
  cookieStore.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());

  return { status: "done" };
}
