"use server";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { withActor, withCredentialId, type Actor } from "@/db/actor";
import { challengeCookieName, challengeMaxAge, verifyChallenge } from "@/lib/auth/challenge";
import { authenticationOptions, verifyAuthentication } from "@/lib/auth/passkey";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/student-session";

/**
 * Anmeldung des Kindes mit einem Passkey (F-06, ADR 0005).
 *
 * Ohne Kennung: Der Browser fragt selbst, welcher Passkey gemeint ist, und
 * liefert dessen ID zurück. Damit schlagen wir das Kind nach – über den engen
 * Weg `withCredentialId`, der genau diese eine Zeile freigibt und sonst
 * nichts (`src/db/policies/0020-student-auth.sql`).
 */

export type LoginStart = { status: "ready"; options: unknown } | { status: "error" };
export type LoginResult = { status: "done" } | { status: "error"; message: string };

export async function startLogin(): Promise<LoginStart> {
  const { options, cookie } = await authenticationOptions();

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

type PasskeyRow = {
  student_id: string;
  public_key: string;
  counter: string;
  transports: string[] | null;
};

export async function completeLogin(response: AuthenticationResponseJSON): Promise<LoginResult> {
  const cookieStore = await cookies();
  const remembered = verifyChallenge("login", cookieStore.get(challengeCookieName)?.value);
  if (!remembered) {
    return { status: "error", message: "Das hat zu lange gedauert. Versuch es noch einmal." };
  }

  const rows = await withCredentialId(response.id, (tx) =>
    tx.execute<PasskeyRow>(
      sql`select student_id, public_key, counter, transports from student_credential`,
    ),
  );
  const row = rows[0];
  if (!row) {
    return {
      status: "error",
      message: "Dieser Passkey gehört zu keinem Profil. Leg dir eines an.",
    };
  }

  const verified = await verifyAuthentication(response, remembered.challenge, {
    credentialId: response.id,
    publicKey: row.public_key,
    // `bigint` kommt als Zeichenkette aus dem Treiber zurück.
    counter: Number(row.counter),
    transports: row.transports,
  });
  if (!verified) {
    return { status: "error", message: "Der Passkey ließ sich nicht bestätigen." };
  }
  cookieStore.delete(challengeCookieName);

  const actor: Actor = { role: "student", studentId: row.student_id };

  await withActor(actor, (tx) =>
    tx.execute(
      sql`update student_credential
          set counter = ${verified.newCounter}, last_used_at = now()
          where credential_id = ${response.id}`,
    ),
  );

  const headerList = await headers();
  const token = await createSession(actor, headerList.get("user-agent"));
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  return { status: "done" };
}
