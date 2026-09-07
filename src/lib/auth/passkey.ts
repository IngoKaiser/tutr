import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { headers } from "next/headers";

import { createChallenge } from "./challenge";

/**
 * Die beiden WebAuthn-Zeremonien (F-06, ADR 0005).
 *
 * Dieses Modul spricht nicht mit der Datenbank – es erzeugt Optionen und
 * prüft Antworten. Was gespeichert wird, entscheiden die Server Actions.
 *
 * Der Kern ist `residentKey: "required"`: Nur ein *auffindbarer* Passkey
 * trägt die Kontozuordnung im Gerät. Erst dadurch kommt die Anmeldung ohne
 * Kennung aus – kein Benutzername, keine E-Mail. Ohne diese Zeile bräuchte
 * das Kind etwas zu tippen, und der ganze Entwurf fiele in sich zusammen.
 */

export const RP_NAME = "tutr";

/**
 * Aus welcher Domain heraus wird angemeldet.
 *
 * Bewusst aus dem Request abgeleitet statt aus einer Umgebungsvariablen:
 * Vercel gibt jedem Vorschau-Deployment eine eigene Domain, und ein
 * festgenagelter rpID würde dort jede Anmeldung ablehnen. Der Host-Header
 * kommt hinter Vercel vom Edge-Netz, nicht vom Client.
 */
export async function relyingParty(): Promise<{ rpID: string; origin: string }> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${protocol}://${host}` };
}

/**
 * Die Kind-ID als 16 Rohbytes – das ist der User-Handle im Authenticator.
 *
 * `Uint8Array<ArrayBuffer>` statt `Uint8Array`: Ein Node-`Buffer` kann laut
 * Typ auf einem `SharedArrayBuffer` sitzen, was die Bibliothek ausschließt.
 * Deshalb einmal in einen eigenen Puffer kopieren.
 */
function userHandle(studentId: string): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.from(studentId.replaceAll("-", ""), "hex");
  const target = new Uint8Array(new ArrayBuffer(bytes.length));
  target.set(bytes);
  return target;
}

function toBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.from(base64url, "base64url");
  const target = new Uint8Array(new ArrayBuffer(bytes.length));
  target.set(bytes);
  return target;
}

/**
 * `remember` wandert signiert im Cookie mit – dort stehen die IDs, unter
 * denen gleich das Profil entsteht. Sie dürfen nicht über den Client laufen,
 * siehe `challenge.ts`.
 */
export async function registrationOptions<T extends object>(
  studentId: string,
  firstName: string,
  remember: T,
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; cookie: string }> {
  const { rpID } = await relyingParty();
  const { bytes, cookie } = createChallenge("register", remember);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: firstName,
    userDisplayName: firstName,
    userID: userHandle(studentId),
    challenge: bytes,
    attestationType: "none",
    authenticatorSelection: {
      // Der Kern des Entwurfs, siehe oben.
      residentKey: "required",
      // „preferred", nicht „required": Auf Handy und Tablet läuft ohnehin
      // Face ID oder ein Code. Ein Gerät ohne Biometrie ganz auszusperren
      // wäre eine Hürde ohne Gegenwert – Konzept §11: „Sicherheit kommt aus
      // Passkeys und dem Familienkonto, nicht aus Hürden."
      userVerification: "preferred",
    },
  });

  return { options, cookie };
}

export type NewPasskey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
};

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  challenge: string,
): Promise<NewPasskey | null> {
  const { rpID, origin } = await relyingParty();

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    // Muss zu `userVerification: "preferred"` oben passen, sonst lehnt die
    // Prüfung genau die Geräte ab, die wir gerade zulassen wollten.
    requireUserVerification: false,
  });

  if (!result.verified) return null;

  const { credential } = result.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? null,
  };
}

/**
 * Ohne `allowCredentials`: Der Browser fragt selbst, welcher Passkey gemeint
 * ist. Das ist die Anmeldung ohne Kennung – und der Grund, warum es die
 * Registrierung mit `residentKey: "required"` braucht.
 */
export async function authenticationOptions(): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  cookie: string;
}> {
  const { rpID } = await relyingParty();
  const { bytes, cookie } = createChallenge("login");

  const options = await generateAuthenticationOptions({
    rpID,
    challenge: bytes,
    userVerification: "preferred",
  });

  return { options, cookie };
}

export type StoredPasskey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
};

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  challenge: string,
  stored: StoredPasskey,
): Promise<{ newCounter: number } | null> {
  const { rpID, origin } = await relyingParty();

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: stored.credentialId,
      publicKey: toBytes(stored.publicKey),
      counter: stored.counter,
      transports: stored.transports ?? undefined,
    },
  });

  if (!result.verified) return null;
  return { newCounter: result.authenticationInfo.newCounter };
}
