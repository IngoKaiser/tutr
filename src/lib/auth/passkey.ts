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

import { neueChallenge } from "./challenge";

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
  const kopf = await headers();
  const host = kopf.get("host") ?? "localhost:3000";
  const schema = kopf.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${schema}://${host}` };
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
  const ziel = new Uint8Array(new ArrayBuffer(bytes.length));
  ziel.set(bytes);
  return ziel;
}

function alsBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.from(base64url, "base64url");
  const ziel = new Uint8Array(new ArrayBuffer(bytes.length));
  ziel.set(bytes);
  return ziel;
}

export async function registrierungsOptionen(
  studentId: string,
  vorname: string,
): Promise<{ optionen: PublicKeyCredentialCreationOptionsJSON; cookie: string }> {
  const { rpID } = await relyingParty();
  const { challenge, cookie } = neueChallenge("registrieren");

  const optionen = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: vorname,
    userDisplayName: vorname,
    userID: userHandle(studentId),
    challenge,
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

  return { optionen, cookie };
}

export type NeuerPasskey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
};

export async function pruefeRegistrierung(
  antwort: RegistrationResponseJSON,
  challenge: string,
): Promise<NeuerPasskey | null> {
  const { rpID, origin } = await relyingParty();

  const ergebnis = await verifyRegistrationResponse({
    response: antwort,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    // Muss zu `userVerification: "preferred"` oben passen, sonst lehnt die
    // Prüfung genau die Geräte ab, die wir gerade zulassen wollten.
    requireUserVerification: false,
  });

  if (!ergebnis.verified) return null;

  const { credential } = ergebnis.registrationInfo;
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
export async function anmeldeOptionen(): Promise<{
  optionen: PublicKeyCredentialRequestOptionsJSON;
  cookie: string;
}> {
  const { rpID } = await relyingParty();
  const { challenge, cookie } = neueChallenge("anmelden");

  const optionen = await generateAuthenticationOptions({
    rpID,
    challenge,
    userVerification: "preferred",
  });

  return { optionen, cookie };
}

export type GespeicherterPasskey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
};

export async function pruefeAnmeldung(
  antwort: AuthenticationResponseJSON,
  challenge: string,
  gespeichert: GespeicherterPasskey,
): Promise<{ neuerZaehler: number } | null> {
  const { rpID, origin } = await relyingParty();

  const ergebnis = await verifyAuthenticationResponse({
    response: antwort,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: gespeichert.credentialId,
      publicKey: alsBytes(gespeichert.publicKey),
      counter: gespeichert.counter,
      transports: gespeichert.transports ?? undefined,
    },
  });

  if (!ergebnis.verified) return null;
  return { neuerZaehler: ergebnis.authenticationInfo.newCounter };
}
